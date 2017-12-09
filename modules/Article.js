const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const debug = require('debug')('modules:Article');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

const CAPI_CONCURRENCE = defaultValueIfNotSet(process.env.CAPI_CONCURRENCE, 4);
const DEFAULT_TERM     = defaultValueIfNotSet(process.env.DEFAULT_TERM, 'brexit');
const DEFAULT_YEAR     = defaultValueIfNotSet(process.env.DEFAULT_YEAR, '2017');

function searchByTerm(searchTerm) {
    const params = {};
	params.queryString = searchTerm;
    return fetchContent.search(params)
}

function searchByParams(params) {
    return fetchContent.search(params)
}

function searchTitlesInYear(term, year) {
  term = defaultValueIfNotSet(term, DEFAULT_TERM);
  year = defaultValueIfNotSet(year, DEFAULT_YEAR);

  const params = {
      queryString : ``,
       maxResults : 100,
           offset : 0,
          aspects : [ "title", "lifecycle"], // [ "title", "location", "summary", "lifecycle", "metadata"],
      constraints : [
        `title:${term}`,
        `lastPublishDateTime:>${year}-01-01T00:00:00Z`,
        `lastPublishDateTime:<${year}-12-31T23:59:59Z`,
      ],
           facets : {"names":[], "maxElements":-1}
    };

    return fetchContent.search(params)
}

function alignTitlesInYear(term, year) {
  term = defaultValueIfNotSet(term, DEFAULT_TERM);
  year = defaultValueIfNotSet(year, DEFAULT_YEAR);

  return searchTitlesInYear(term, year)
  .then(articles => {
    const results = (articles && articles.sapiObj && articles.sapiObj.results && articles.sapiObj.results[0] && articles.sapiObj.results[0].results)? articles.sapiObj.results[0].results : [];
    // const regexStr = `^(.*?)\b(${searchterm})\b(.*)`;
    const regexStr = `^(.*?)\\b(${term})\\b(.*)`;
    const regex = new RegExp(regexStr, 'i');
    // debug(`alignTitlesInYear: regexStr=${JSON.stringify(regexStr)}`);
    return results.map( result => {
      const title = result.title.title;
      const match = regex.exec(title);
      // debug(`alignTitlesInYear: title=${title}, match=${JSON.stringify(match)}`);
      return {
        title,
        titleParts : (match)? [match[1], match[2], match[3]] : [],
        id         : result.id,
        aspectSet  : result.aspectSet,
        url        : `https://www.ft.com/content/${result.id}`,
        lastPublishDateTime : result.lifecycle.lastPublishDateTime,
      }
    }).filter(result => result.titleParts.length > 0);
  }).then(results => {
    results.sort((a,b) => {
      const diffLeftLength = b.titleParts[0].length - a.titleParts[0].length;
      if (diffLeftLength !== 0) {
        return diffLeftLength;
      }
      const aLeftLower = a.titleParts[0].toLowerCase();
      const bLeftLower = b.titleParts[0].toLowerCase();
      if (aLeftLower !== bLeftLower) {
        return (aLeftLower < bLeftLower)? -1 : 1;
      }
      const diffRightLength = a.titleParts[2].length - b.titleParts[2].length;
      if (diffRightLength !== 0) {
        return diffRightLength;
      }
      const aRightLower = a.titleParts[2].toLowerCase();
      const bRightLower = b.titleParts[2].toLowerCase();
      if (aRightLower !== bRightLower) {
        return (aRightLower < bRightLower)? -1 : 1;
      }
      return 0;
    });

    return {
      description : 'articles with titles matching the specified term in the specified year; titles are then split and aligned on the term, and sorted by length of text before the term.',
      term,
      year,
      results
    }
  })
  ;
}

function articleByUUID(uuid) {
    return fetchContent.article(uuid)
}

function searchEntityDateRange(ontology, id, fromDate, toDate) {

  fromDate = fromDate.replace(/\.\d+Z$/, 'Z');
  toDate   =   toDate.replace(/\.\d+Z$/, 'Z');

  const params = {
      queryString : ``,
       maxResults : 100,
           offset : 0,
          aspects : [ "title", "lifecycle"], // [ "title", "location", "summary", "lifecycle", "metadata"],
      constraints : [
        `${ontology}:${id}`,
        // `title:Brexit`,
        `lastPublishDateTime:>${fromDate}`,
        `lastPublishDateTime:<${toDate}`,
      ],
           facets : {"names":[], "maxElements":-1}
    };

    return fetchContent.search(params)
}

module.exports = {
    searchByTerm,
    searchByParams,
    searchTitlesInYear,
    alignTitlesInYear,
    articleByUUID,
    searchEntityDateRange,
}
