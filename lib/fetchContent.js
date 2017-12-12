// This module makes use of 'node-fetch' to acces SAPI

const fetch = require('node-fetch');
const debug = require('debug')('lib:fetchContent');
const SimpleCache = require('../helpers/simple-cache');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

const CAPI_KEY = process.env.CAPI_KEY;
if (! CAPI_KEY ) {
	throw new Error('ERROR: CAPI_KEY not specified in env');
}
const CAPI_PATH = 'http://api.ft.com/enrichedcontent/';
const SAPI_PATH = 'http://api.ft.com/content/search/v1';
const DEFAULT_MAX_RESULTS = defaultValueIfNotSet(process.env.DEFAULT_MAX_RESULTS, 100);

// NB: should only match basic ontology values, maybe with Id suffix, e.g. people and peopleId,
// and *not* other constraint fields such as lastPublishDateTime (with upper case parts)
const EntityRegex = /^([a-z]+(?:Id)?):(.+)$/;
function rephraseEntityForQueryString(item){
	const match = EntityRegex.exec(item);
	if (match) {
		return match[1] + ':\"' + match[2] + '\"';
	} else {
		return item;
	}
}

// const valid facetNames = [
//   "authors",
//   "authorsId",
//   "brand",
//   "brandId",
//   "category",
//   "format",
//   "genre",
//   "genreId",
//   "icb",
//   "icbId",
//   "iptc",
//   "iptcId",
//   "organisations",
//   "organisationsId",
//   "people",
//   "peopleId",
//   "primarySection",
//   "primarySectionId",
//   "primaryTheme",
//   "primaryThemeId",
//   "regions",
//   "regionsId",
//   "sections",
//   "sectionsId",
//   "specialReports",
//   "specialReportsId",
//   "subjects",
//   "subjectsId",
//   "topics",
//   "topicsId"
// ];

function constructSAPIQuery( params ) {

	const defaults = {
		queryString : "",
	   maxResults : DEFAULT_MAX_RESULTS,
		     offset : 0,
			aspects : [ "title",  "lifecycle", "location"], // [ "title", "location", "summary", "lifecycle", "metadata"],
		constraints : [],
		facets: {"names":[ "people", "organisations", "topics", "peopleId", "organisationsId", "topicsId"], "maxElements":-1}
	};
	const combined = Object.assign({}, defaults, params);
	let queryParts =
		(combined.queryString !== null && combined.queryString !== '')? [combined.queryString] : [];
	queryParts = queryParts.concat(combined.constraints);

	const queryString =
		queryParts
		.map(c => { return rephraseEntityForQueryString(c); })
		.join(' and ');

	const full = {
  	queryString: queryString,
  	queryContext : {
		curations: ["ARTICLES"]
	},
  	resultContext : {
			maxResults : `${combined.maxResults}`,
		 	    offset : `${combined.offset}`,
			   aspects : combined.aspects,
			 sortOrder : "DESC",
			 sortField : "lastPublishDateTime",
			    facets : combined.facets
  	}
	}
	return full;
}

const FetchTimings = {};

function recordFetchTiming( method, timing, resOk, status, statusText ){
	if (!FetchTimings.hasOwnProperty(method)) {
		FetchTimings[method] = [];
	}
	FetchTimings[method].push({
		timing,
		resOk,
		status,
		statusText
	});
}

function summariseFetchTimings(history){
	const summary = {};
	Object.keys(FetchTimings).forEach( method => {
		const totalCount = FetchTimings[method].length;
		history = (history)? history : totalCount;
		const recentFew = FetchTimings[method].slice(- history)
		const count = recentFew.length;
		let statusesNotOk = [];
		let numOk = 0;
		let numNotOk = 0;
		let sum = 0;
		let max = 0;
		let min = -1;
		recentFew.forEach( item => {
			if (item.resOk) {
				numOk = numOk + 1;
			} else {
				numNotOk = numNotOk + 1;
				statusesNotOk.push({ status: item.status, statusText: item.statusText});
			}

			sum = sum + item.timing
			max = Math.max(max, item.timing);
			min = (min == -1)? item.timing : Math.min(min, item.timing);
		});
		summary[method] = {
			totalCount : FetchTimings[method].length,
			count,
			mean : sum / count,
			max,
			min,
			numOk,
			numNotOk,
			statusesNotOk,
		};
	});

	return summary;
}

function fetchWithTiming(url, options={}) {
	const startMillis = Date.now();
	return fetch(url, options)
	.then( res => {
		const endMillis = Date.now();
		const timing = endMillis - startMillis;
		return { res, timing };
	})
}

function fetchResText(url, options){
	return fetchWithTiming(url, options)
	.then(resWithTiming => {
		const method = (options && options.method == 'POST')? 'POST' : 'GET';
		const res = resWithTiming.res;
		const resOk = (res && res.ok);
		const timing = resWithTiming.timing;
		recordFetchTiming( method, timing, resOk, res.status, res.statusText);
		if(resOk){
			return res;
		} else {
			throw new Error(`fetchResText: res not ok: res.status=${res['status']}, res.statusText=${res['statusText']}, url=${url}, options=${JSON.stringify(options)}`);
		}
	})
	.then( res  => res.text() )
	;
}

const SEARCH_CACHE = new SimpleCache();

function search(params) {
	const sapiUrl = `${SAPI_PATH}?apiKey=${CAPI_KEY}`;
	const sapiQuery = constructSAPIQuery( params );
	const options = {
		 method: 'POST',
       body: JSON.stringify(sapiQuery),
		headers: {
			'Content-Type' : 'application/json',
		}
	};
	debug(`search: sapiQuery=${JSON.stringify(sapiQuery)}`);

	const cachedSearchItem = SEARCH_CACHE.read( options );
	if (cachedSearchItem !== undefined) {
		debug(`search: cache hit: sapiQuery=${JSON.stringify(sapiQuery)}`);
		return Promise.resolve(cachedSearchItem);
	}

	return fetchResText(sapiUrl, options)
	.then( text => {
		let sapiObj;
		try {
		 	sapiObj = JSON.parse(text);
		}
		catch( err ){
			throw new Error(`JSON.parse: err=${err},
				text=${text},
				params=${params}`);
		}

		const searchItem = {
			params,
			sapiObj
		};

		SEARCH_CACHE.write(options, searchItem);

		return searchItem;
	} )
	.catch( err => {
		console.log(`ERROR: search: err=${err}.`);
		return { params }; // NB, no sapiObj...
	})
	;
}

// maxDepth == 1 => do 1 search, 2 ==> max 2 searches, etc
// return list of searchItems
function searchDeeper(params, maxDepth = 3){
	if (maxDepth < 1) {
		return [];
	}
	return search(params)
	.then( searchItem => {
		const sapiObj = searchItem.sapiObj;

		searchItem.maxDepth         = maxDepth;
		searchItem.offset           = sapiObj.query.resultContext.offset;
		searchItem.maxResults       = sapiObj.query.resultContext.maxResults;
		searchItem.indexCount       = sapiObj.results[0].indexCount;
		searchItem.thisNumResults   = sapiObj.results[0].results.length;
		searchItem.remainingResults = Math.max(0, searchItem.indexCount - searchItem.thisNumResults - searchItem.offset);

		const searchItems = [searchItem]
		if( searchItem.maxDepth < 2 || searchItem.remainingResults <= 0){
			return searchItems;
		}

		const nextParams = Object.assign({}, params);
		if (!nextParams.hasOwnProperty('offset')) {
				nextParams.offset = 0;
		}
		nextParams.offset = nextParams.offset + searchItem.maxResults;
		return searchDeeper( nextParams, maxDepth-1 )
		.then( nextSearchItems => searchItems.concat(nextSearchItems) )
		;
	})
	.catch( err => {
		console.log(`WARNING: searchDeeper: maxDepth=${maxDepth}: err=${err}`);
		return []; // if in doubt, return an empty list
	})
	;
}

const ARTICLE_CACHE = new SimpleCache();

function article(uuid) {
	debug(`uuid=${uuid}`);
	const capiUrl = `${CAPI_PATH}${uuid}?apiKey=${CAPI_KEY}`;

	const articleItem = ARTICLE_CACHE.read( uuid );
	if (articleItem !== undefined) {
		debug(`article: cache hit: uuid=${uuid}`);
		return Promise.resolve( articleItem );
	}

	return fetchResText(capiUrl)
	.then( text  => {
		let articleItem;
		try {
			articleItem = JSON.parse(text);
		}
		catch( err ){
			throw new Error(`JSON.parse: err=${err},
				text=${text},
				uuid=${uuid}`);
		}

		ARTICLE_CACHE.write( uuid, articleItem);
		return articleItem;
	})
	.catch( err => {
		console.log(`ERROR: article: err=${err}.`);
		return {}; // NB, no article Obj...
	})
	;
}

function v2ApiCall( apiUrl ){
	const url = `${apiUrl}?apiKey=${CAPI_KEY}`;
	debug(`v2ApiCall: url=${url}`);
	return fetchResText(url)
	.then( text => {
		debug(`v2ApiCall: text=${text}`);
		return text;
	})
	.then( text  => JSON.parse(text) )
	.catch( err => {
		debug(`v2ApiCall: err=${err}`);
	})
	;
}

function v2v1Concordance( v2Url ){
	const url = `http://api.ft.com/concordances?apiKey=${CAPI_KEY}&conceptId=${v2Url}`;
	debug(`v2v1Concordance: url=${url}`);
	return fetchResText(url)
	.then( text => {
		debug(`v2v1Concordance: text=${text}`);
		return text;
	})
	.then( text  => JSON.parse(text) )
	.catch( err => {
		debug(`v2v1Concordance: err=${err}`);
	})
	;
}

const TME_CACHE = new SimpleCache();

function tmeIdsOfV2Annotation( v2Annotation ){
	let tmeItem = TME_CACHE.read( v2Annotation );
	if (tmeItem !== undefined) {
		debug(`article: cache hit: tmeItem=${tmeItem}`);
		return Promise.resolve( tmeItem );
	}

	return v2v1Concordance( v2Annotation )
	.then(concordanceData => {
		const tmeIds = [];
		if ( concordanceData && concordanceData.concordances ){

			concordanceData.concordances.forEach( c => {
				if (
						c.identifier
						&& c.identifier.authority === 'http://api.ft.com/system/FT-TME'
						&& c.identifier.identifierValue
					) {
					tmeIds.push(c.identifier.identifierValue);
				}
			});
		}

		TME_CACHE.write( v2Annotation, tmeIds);
		return tmeIds;
	})
	;
}

const KNOWN_TME_ENDINGS = {
	'UE4='         : 'peopleId',
	'T04='         : 'organisationsId',
	'R0w='          : 'regionsId',
	'U2VjdGlvbnM=' : 'sectionsId',
	'VG9waWNz'     : 'topicsId',
};

// return '' if no matching ontology
function convertTmeIdToV1Id( tmeId ){
	const match = tmeId.match(/-([^\-]+)$/);
	const handle = (match !== null)? match[1] : '';
	const ontology = (KNOWN_TME_ENDINGS.hasOwnProperty(handle))? KNOWN_TME_ENDINGS[handle] : '';
	const v1Id = (ontology)? `${ontology}:${tmeId}` : '';
	// debug(`convertTmeIdToV1Id: tmeId=${tmeId}, handle=${handle}, ontology=${ontology}, v1Id=${v1Id}`);
	return v1Id;
}

function v1IdsOfV2Annotation( v2Annotation ){
	// debug(`v1IdsOfV2Annotation: v2Annotation=${v2Annotation}`);
	return tmeIdsOfV2Annotation( v2Annotation )
	.then( tmeIds => tmeIds.map( convertTmeIdToV1Id ) )
	.then( v1Ids => v1Ids.filter( v => (v !== '') ))
	;
}

// return null if duff/empty args
function searchByTmeId( params, tmeId ){
	const v1Id = convertTmeIdToV1Id( tmeId );
	if (! v1Id ) {
		return Promise.resolve(null);
	}
	if (!params.hasOwnProperty('constraints')) {
		params.constraints = [];
	}
	params.constraints.push(v1Id);

	return search(params)
	;
}

module.exports = {
	search,
	article,
	v2ApiCall,
	v2v1Concordance,
	tmeIdsOfV2Annotation,
	v1IdsOfV2Annotation,
	searchByTmeId,
	searchDeeper,
};
