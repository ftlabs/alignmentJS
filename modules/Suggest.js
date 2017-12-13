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
const DEFAULT_DAYS_BEFORE = defaultValueIfNotSet(process.env.DEFAULT_DAYS_BEFORE, 0);
const DEFAULT_DAYS_AFTER  = defaultValueIfNotSet(process.env.DEFAULT_DAYS_AFTER,  0);

function addDaysToStringDate( dateString, days=0 ){
  const dateMs = Date.parse( dateString );
  const newDateMs = dateMs + (days * 24 * 60 * 60 * 1000);
  const newDate = new Date(newDateMs);
  return newDate.toISOString();
}

// calc date range of uuids
// calc combined sig of articles
// map from v2 annotations to v1 ids that work with SAPI
// search each annotation, within date range, for uuids
// calc sig score for each uuid with combined sig
// group by week(?)
// sort by score
function suggestBetween( uuids, daysBefore=DEFAULT_DAYS_BEFORE, daysAfter=DEFAULT_DAYS_AFTER ){
  if (uuids.length == 0) {
    uuids = ['2ebe9c54-d82e-11e7-a039-c64b1c09b482'];
  }
  daysBefore = Math.max(0, daysBefore);
  daysAfter  = Math.max(0, daysAfter );
  let combinedSig;

  return Signature.byUuids( uuids )
  .then( sig => {
    combinedSig = sig;
    const v2Annotations = Object.keys(sig.annotations.byId);
    const fromDate = sig.publishedDates.earliest;
    const toDate   = sig.publishedDates.latest;

    const newFromDate = addDaysToStringDate(sig.publishedDates.earliest, - daysBefore);
    const newToDate   = addDaysToStringDate(sig.publishedDates.latest,     daysAfter );

    return Article.searchDeeperOredV2AnnotationsInDateRangeToArticleIds( v2Annotations, newFromDate, newToDate );
  })
  .then( articles => articles.filter( a => !uuids.includes(a.id) ) )
  .then( articles => calcSigsForArticlesGivenUuids(uuids, articles) )
  .then( sigs => {
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
        combinedSig,
        daysBefore,
        daysAfter,
      },
      caveats : 'too many to mention: might not have scanned entire range of articles between exemplars',
    };
  })
}

// take a list of article handles (containing id etc),
// calc the sig for each one,
// return promise of all sigs
function calcSigsForArticlesGivenUuids( uuids, articles ){
  const promisers = articles.map( a => {
    return function() {
      return Signature.byUuids( uuids.concat(a.id) )
      .catch( err => {
        console.log( `ERROR: calcSigsForArticlesGivenUuids: promise for article=${a}, err=${err}`);
        return;
      })
      ;
    };
  });
  return directly(SUGGEST_CONCURRENCE, promisers);
}

const IGNORE_BUCKETS_WORSE_THAN = 0.3;

function suggestBetweenTabulated(uuids, ignoreBucketsWorseThan=IGNORE_BUCKETS_WORSE_THAN, daysBefore=DEFAULT_DAYS_BEFORE, daysAfter=DEFAULT_DAYS_AFTER){
  if (ignoreBucketsWorseThan === undefined || ignoreBucketsWorseThan == null || ignoreBucketsWorseThan === '') {
    ignoreBucketsWorseThan=IGNORE_BUCKETS_WORSE_THAN;
  }
  ignoreBucketsWorseThan = parseFloat(ignoreBucketsWorseThan);
  return suggestBetween( uuids, daysBefore, daysAfter )
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

    const minBucket = (maxNonEmptyBucket > ignoreBucketsWorseThan)? ignoreBucketsWorseThan : maxNonEmptyBucket;
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
        };
      }),
    }

    const optionsForIgnoreWorseThan = knownBuckets.map( b => {
      return {
        value : b,
        selected : (b === ignoreBucketsWorseThan),
      }
    })

    const exposeSig = {
      annotations : [],
      nonStopWords : [],
    };

    Object.keys(suggestions.given.combinedSig.annotations.byPredicate).forEach( pred => {
      Object.keys(suggestions.given.combinedSig.annotations.byPredicate[pred]).forEach( anno => {
        exposeSig.annotations.push(suggestions.given.combinedSig.annotations.byPredicate[pred][anno]);
      });
    });
    exposeSig.annotationsAsString = exposeSig.annotations.join(', ');
    exposeSig.nonStopWords = suggestions.given.combinedSig.wordStats.texts.allNonStopWords;
    exposeSig.nonStopWordsAsString = exposeSig.nonStopWords.join(', ');

    suggestions.tabulatedArticles = {
      knownDates,
      knownBuckets : goodEnoughBuckets,
      tabulatedSuggestions,
      given : tabulatedGiven,
      rangeDescription : 'BETWEEN the dates of the exemplar articles',
      ignoreBucketsWorseThan,
      optionsForIgnoreWorseThan,
      exposeSig,
      caveats : suggestions.caveats,
      daysBefore : suggestions.given.daysBefore,
      daysAfter : suggestions.given.daysAfter,
    };

    return suggestions;
  })
  ;
}

module.exports = {
  between : suggestBetween,
  betweenTabulated : suggestBetweenTabulated,
  // before : suggestBefore,
  // after : suggestAfter,
  addDaysToStringDate,
}
