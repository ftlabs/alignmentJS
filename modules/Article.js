const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const debug = require('debug')('modules:Article');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

const CAPI_CONCURRENCE = defaultValueIfNotSet(process.env.CAPI_CONCURRENCE, 4);
const DEFAULT_TERM     = defaultValueIfNotSet(process.env.DEFAULT_TERM, 'brexit');
const DEFAULT_YEAR     = defaultValueIfNotSet(process.env.DEFAULT_YEAR, '2019');
const DEFAULT_SORTBY   = defaultValueIfNotSet(process.env.DEFAULT_SORTBY, 'position');

function searchByTerm(searchTerm) {
    const params = {};
	params.queryString = searchTerm;
    return fetchContent.search(params)
}

function searchByParams(params) {
    return fetchContent.search(params)
}

function searchTitlesInYear(term=DEFAULT_TERM, year=DEFAULT_YEAR) {

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

function alignTitlesInYear(term=DEFAULT_TERM, year=DEFAULT_YEAR, sortBy=DEFAULT_SORTBY) {

  const sortByFns = {
    'position' : function(a,b){
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
    },
    'pre' : function(a,b){
      const aPre = a.titleParts[0].split('').reverse().join('').toLowerCase();
      const bPre = b.titleParts[0].split('').reverse().join('').toLowerCase();

      if     (aPre > bPre) { return -1; }
      else if(aPre < bPre) { return +1; }
      else                 { return  0; }
    },
    'post' : function(a,b){
      const aPost = a.titleParts[2].split().reverse().join('').toLowerCase();
      const bPost = b.titleParts[2].split().reverse().join('').toLowerCase();

      if     (aPost > bPost) { return -1; }
      else if(aPost < bPost) { return +1; }
      else                   { return  0; }
    },
  }

  if (! sortByFns.hasOwnProperty(sortBy)) {
    throw new Error(`ERROR: sortBy value not recognised : ${JSON.stringify(sortBy)}`);
  }

  const sortByFn = sortByFns[sortBy];

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
    results.sort(sortByFn);

    return {
      description : `articles with titles matching the specified term in the specified year; titles are then split and aligned on the term, and sorted by ${sortBy}.`,
      term,
      year,
      sortBy,
      sortBys : Object.keys( sortByFns ),
      sortBysWithSelected : Object.keys( sortByFns ).map( sb => {
        return {
          sortBy: sb,
          selected : (sb === sortBy),
        }
      }),
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

function searchOredV1IdsInDateRange(v1Ids, fromDate, toDate) {

  fromDate = fromDate.replace(/\.\d+Z$/, 'Z');
  toDate   =   toDate.replace(/\.\d+Z$/, 'Z');

  const oredV1IdsTerm = createOredSearchTermOfV1Ids( v1Ids );

  const params = {
      queryString : ``,
       maxResults : 100,
           offset : 0,
          aspects : [ "title", "lifecycle"], // [ "title", "location", "summary", "lifecycle", "metadata"],
      constraints : [
        oredV1IdsTerm,
        `lastPublishDateTime:>${fromDate}`,
        `lastPublishDateTime:<${toDate}`,
      ],
           facets : {"names":[], "maxElements":-1}
    };

    return fetchContent.search(params)
}

// given a list of v2Annotations,
// convert to a list of v1Ids,
// searchDeeper using all the v1Ids ORed together,
// extract all the article items
function searchDeeperOredV2AnnotationsInDateRangeToArticleIds(v2Annotations, fromDate, toDate) {
  fromDate = fromDate.replace(/\.\d+Z$/, 'Z');
  toDate   =   toDate.replace(/\.\d+Z$/, 'Z');

  const params = {
      queryString : ``,
       maxResults : 100,
           offset : 0,
          aspects : [ "title", "lifecycle"], // [ "title", "location", "summary", "lifecycle", "metadata"],
      constraints : [
        `lastPublishDateTime:>${fromDate}`,
        `lastPublishDateTime:<${toDate}`,
      ],
           facets : {"names":[], "maxElements":-1}
    };

  return fetchContent.v1IdsOfV2Annotations(v2Annotations)
  .then( v1Ids => createOredSearchTermOfV1Ids( v1Ids ) )
  .then( oredV1IdsTerm => {
    params.constraints.push(oredV1IdsTerm);
    return fetchContent.searchDeeper(params);
  })
  .then( searchResultList => extractArticleIdsFromSearchResults( searchResultList ) )
  ;
}

// loop over search result objs
//   extract each list of results, convert to article searchItems
// concat list of lists of article items
function extractArticleIdsFromSearchResults( searchResultList ){
  const articlesLists = searchResultList.map( searchResults => {
    const results = (searchResults && searchResults.sapiObj && searchResults.sapiObj.results && searchResults.sapiObj.results[0] && searchResults.sapiObj.results[0].results)? searchResults.sapiObj.results[0].results : [];
    const articles = results.map( r => {
      return {
        id : r.id,
        title : r.title.title,
        lastPublishDateTime : r.lifecycle.lastPublishDateTime,
      };
    });
    return articles;
  });
  const articles = [].concat.apply([], articlesLists);
  return articles;
}

// 'ontology:VALUE' --> 'ontology:\"VALUE\"'
function escapeV1Id( id ){
  const parts = id.split(':');
  const ontology = parts[0];
  const value = parts.slice(1).join(':'); // possible id might have contained 2 or more colons so needs to be unsplit?
  return `${ontology}:\"${value}\"`;
}

function createOredSearchTermOfV1Ids( v1Ids ){
  if (v1Ids.length == 0) {
    return '';
  } else {
    return (v1Ids.length == 1)? v1Ids[0] : `(${v1Ids.map(escapeV1Id).join(' OR ')})`;
  }
}

function searchByV2Annotation(v2Annotation) {
  return fetchContent.v1IdsOfV2Annotation( v2Annotation )
  .then( v1Ids => createOredSearchTermOfV1Ids(v1Ids) )
  .then( term => searchByTerm( term ) )
  ;
}

function searchDeeperByTerm(searchTerm, maxDepth=2) {
  const params = {};
	params.queryString = searchTerm;

  return fetchContent.searchDeeper(params, maxDepth);
}

module.exports = {
    searchByTerm,
    searchByParams,
    searchTitlesInYear,
    alignTitlesInYear,
    articleByUUID,
    searchEntityDateRange,
    searchByV2Annotation,
    searchOredV1IdsInDateRange,
    searchDeeperByTerm,
    extractArticleIdsFromSearchResults,
    searchDeeperOredV2AnnotationsInDateRangeToArticleIds,
}
