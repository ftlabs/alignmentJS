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
      const promisers = articles.map( a => {
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
        const uuid = s.uuids[s.uuids.length -1];
        return {
          score : Math.round(s.score.amount*100)/100,
          uuid,
          title : s.titles[s.titles.length -1].replace(/\(.*/, ''),
          lastPublishDateTime : s.sources[s.sources.length -1].publishedDates.earliest,
          url : `https://www.ft.com/content/${uuid}`,
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

const IGNORE_BUCKETS_WORSE_THAN = 0.3;

function suggestBetweenTabulated(uuids){
  return suggestBetween( uuids )
  .then( suggestions => {
    const datesScores = {};
    const knownBuckets = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
    let maxNonEmptyBucket = 0;

    suggestions.articles.forEach( article => {
      const dayString = article.lastPublishDateTime.replace(/T.*/,'');
      let scoreBucket = Math.ceil(article.score*10)/10;
      if (scoreBucket === 0) {
        scoreBucket = 0.1;
      }
      maxNonEmptyBucket = (scoreBucket > maxNonEmptyBucket)? scoreBucket : maxNonEmptyBucket;

      if (! datesScores.hasOwnProperty(dayString)) {
        datesScores[dayString] = {};
        knownBuckets.forEach( b => {
          datesScores[dayString][b] = [];
        });
      }
      datesScores[dayString][scoreBucket].push(article);
    });

    const knownDates = Object.keys(datesScores).sort();

    const minBucket = (maxNonEmptyBucket > IGNORE_BUCKETS_WORSE_THAN)? IGNORE_BUCKETS_WORSE_THAN : maxNonEmptyBucket;
    const goodEnoughBuckets = knownBuckets.filter( b => (b >= minBucket));
    const tabulatedSuggestions = knownDates.map(d => {
      return row = {
        date : d,
        buckets : goodEnoughBuckets.map(b => {
          return datesScores[d][b];
        }),
      };
    });

    const tabulatedGiven = {
      score : Math.round(suggestions.given.score.amount*100)/100,
      rangeInDays : Math.round(suggestions.given.publishedDates.rangeInDays*10)/10,
      examples : suggestions.given.titles.map( (t, i) => {
        return {
          title : t,
          uuid : suggestions.given.uuids[i],
          url : `https://www.ft.com/content/${suggestions.given.uuids[i]}`,
        }
      })
    }

    suggestions.tabulatedArticles = {
      knownDates,
      knownBuckets : goodEnoughBuckets,
      tabulatedSuggestions,
      given : tabulatedGiven,
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
