// const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const Signature = require('./Signature');
const Article = require('./Article');
const SimpleCache = require('../helpers/simple-cache');
const debug = require('debug')('modules:Suggest');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

const SUGGEST_CONCURRENCE = defaultValueIfNotSet(process.env.SUGGEST_CONCURRENCE, 2);

// calc date range of uuids
// calc combined sig of articles
// map from v2 annotations to v1 ids that work with SAPI
// search each annotation, within date range, for uuids
// calc sig score for each uuid with combined sig
// group by week(?)
// sort by score
function suggestBetween( uuids ){
  let combinedSig;

  return Signature.byUuids( uuids )
  .then( sig => {
    combinedSig = sig;
    return Article.searchEntityDateRange('genre', 'News', sig.publishedDates.earliest, sig.publishedDates.latest)
    .then( searchResults => {
      const results = (searchResults && searchResults.sapiObj && searchResults.sapiObj.results && searchResults.sapiObj.results[0] && searchResults.sapiObj.results[0].results)? searchResults.sapiObj.results[0].results : [];
      const articles = results.map( r => {
        return {
          id : r.id,
          title : r.title.title,
          lastPublishDateTime : r.lifecycle.lastPublishDateTime,
        };
      });
      return articles;
    })
    .then( articles => {
      const promisers = articles.slice(0,20).map( a => {
        return function() {
          return Signature.byUuids( uuids.concat(a.id) )
          .catch( err => {
            console.log( `ERROR: getAllEntityFacets: promise for entity=${entity}, err=${err}`);
            return;
          })
          ;
        };
      });

      return directly(SUGGEST_CONCURRENCE, promisers);
    })
    .then(sigs => {
      const suggestions = sigs.filter(s => (s !== null)).map(s => {
        return {
          score : s.score.amount,
          uuid : s.uuids[s.uuids.length -1],
          title : s.titles[s.titles.length -1],
          lastPublishDateTime : s.sources[s.sources.length -1].publishedDates.earliest,
        }
      });

      suggestions.sort( (a,b) => (b.score - a.score) );

      return {
        articles : suggestions,
        given : {
          titles : combinedSig.titles,
          score : combinedSig.score,
          uuids : combinedSig.uuids,
          publishedDates : combinedSig.publishedDates,
        },
        caveats : 'just searching for genre:News for now, albeit within the date range of the given uuids',
      };
    })
  })
}

function suggestBetweenTabulated(uuids){
  return suggestBetween( uuids )
  .then( suggestions => {
    const datesScores = {};
    const knownBuckets = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];

    suggestions.articles.forEach( article => {
      const dayString = article.lastPublishDateTime.replace(/T.*/,'');
      const scoreBucket = Math.ceil(article.score*10)/10;
      if (! datesScores.hasOwnProperty(dayString)) {
        datesScores[dayString] = {};
        knownBuckets.forEach( b => {
          datesScores[dayString][b] = [];
        });
      }
      datesScores[dayString][scoreBucket].push(article);
    });

    const knownDates = Object.keys(datesScores).sort();

    suggestions.tabulatedArticles = {
      knownDates,
      knownBuckets,
      datesScores
    };
    return suggestions;
  })
  ;
}

module.exports = {
  between : suggestBetween,
  betweenTabulated : suggestBetweenTabulated
  // before : suggestBefore,
  // after : suggestAfter,
}
