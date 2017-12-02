const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const debug = require('debug')('modules:Article');
const CAPI_CONCURRENCE = (process.env.hasOwnProperty('CAPI_CONCURRENCE'))? process.env.CAPI_CONCURRENCE : 4;

function searchByTerm(searchTerm) {
    const params = {};
	params.queryString = searchTerm;
    return fetchContent.search(params)
}

function searchByParams(params) {
    return fetchContent.search(params)
}

function searchTitlesInYear(term, year) {
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
  if (term === null || term === undefined || term === '') {
    term = 'brexit';
  }
  if (year === null || year === undefined) {
    year = '2017';
  }
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

module.exports = {
    searchByTerm,
    searchByParams,
    searchTitlesInYear,
    alignTitlesInYear,
}
