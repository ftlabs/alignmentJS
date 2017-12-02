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
          aspects : [ "title"], // [ "title", "location", "summary", "lifecycle", "metadata"],
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
    return searchTitlesInYear(term, year)
    .then(articles => {
      const results = (articles && articles.sapiObj && articles.sapiObj.results && articles.sapiObj.results[0] && articles.sapiObj.results[0].results)? articles.sapiObj.results[0].results : [];
      // const regexStr = `^(.*?)\b(${searchterm})\b(.*)`;
      const regexStr = `^(.*?)(${term})(.*)`;
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
        }
      }).filter(result => result.titleParts.length > 0);
    }).then(results => {
      return results.sort((a,b) => b.titleParts[0].length - a.titleParts[0].length);
    })
    ;
}

module.exports = {
    searchByTerm,
    searchByParams,
    searchTitlesInYear,
    alignTitlesInYear,
}
