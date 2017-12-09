// const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const Article = require('./Article');
const SimpleCache = require('../helpers/simple-cache');
const debug = require('debug')('modules:Signature');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

// const DEFAULT_YEAR     = defaultValueIfNotSet(process.env.DEFAULT_YEAR, '2017');

const TagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';

const TagOrComment = new RegExp(
  '<(?:'
  // Comment body.
  + '!--(?:(?:-*[^->])*--+|-?)'
  // Special "raw text" elements whose content should be elided.
  + '|script\\b' + TagBody + '>[\\s\\S]*?</script\\s*'
  + '|style\\b' + TagBody + '>[\\s\\S]*?</style\\s*'
  // Regular name
  + '|/?[a-z]'
  + TagBody
  + ')>',
  'gi');

function removeTags(html) {
  var oldHtml;
  do {
    oldHtml = html;
    html = html.replace(TagOrComment, '');
  } while (html !== oldHtml);
  return html.replace(/</g, '&lt;');
}

const STOP_WORDS_LIST = ["i", "a", "about", "above", "above", "across", "after", "afterwards", "again", "against", "all", "almost", "alone", "along", "already", "also","although","always","am","among", "amongst", "amoungst", "amount",  "an", "and", "another", "any","anyhow","anyone","anything","anyway", "anywhere", "are", "around", "as",  "at", "back","be","became", "because","become","becomes", "becoming", "been", "before", "beforehand", "behind", "being", "below", "beside", "besides", "between", "beyond", "bill", "both", "bottom","but", "by", "call", "can", "cannot", "cant", "co", "con", "could", "couldnt", "cry", "de", "describe", "detail", "do", "done", "down", "due", "during", "each", "eg", "eight", "either", "eleven","else", "elsewhere", "empty", "enough", "etc", "even", "ever", "every", "everyone", "everything", "everywhere", "except", "few", "fifteen", "fify", "fill", "find", "fire", "first", "five", "for", "former", "formerly", "forty", "found", "four", "from", "front", "full", "further", "get", "give", "go", "had", "has", "hasnt", "have", "he", "hence", "her", "here", "hereafter", "hereby", "herein", "hereupon", "hers", "herself", "him", "himself", "his", "how", "however", "hundred", "ie", "if", "in", "inc", "indeed", "interest", "into", "is", "it", "its", "itself", "keep", "last", "latter", "latterly", "least", "less", "ltd", "made", "many", "may", "me", "meanwhile", "might", "mill", "mine", "more", "moreover", "most", "mostly", "move", "much", "must", "my", "myself", "name", "namely", "neither", "never", "nevertheless", "next", "nine", "no", "nobody", "none", "noone", "nor", "not", "nothing", "now", "nowhere", "of", "off", "often", "on", "once", "one", "only", "onto", "or", "other", "others", "otherwise", "our", "ours", "ourselves", "out", "over", "own","part", "per", "perhaps", "please", "put", "rather", "re", "same", "see", "seem", "seemed", "seeming", "seems", "serious", "several", "she", "should", "show", "side", "since", "sincere", "six", "sixty", "so", "some", "somehow", "someone", "something", "sometime", "sometimes", "somewhere", "still", "such", "system", "take", "ten", "than", "that", "the", "their", "them", "themselves", "then", "thence", "there", "thereafter", "thereby", "therefore", "therein", "thereupon", "these", "they", "thickv", "thin", "third", "this", "those", "though", "three", "through", "throughout", "thru", "thus", "to", "together", "too", "top", "toward", "towards", "twelve", "twenty", "two", "un", "under", "until", "up", "upon", "us", "very", "via", "was", "we", "well", "were", "what", "whatever", "when", "whence", "whenever", "where", "whereafter", "whereas", "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while", "whither", "who", "whoever", "whole", "whom", "whose", "why", "will", "with", "within", "without", "would", "yet", "you", "your", "yours", "yourself", "yourselves", "the"];

const STOP_WORDS = {};
STOP_WORDS_LIST.forEach( word => { STOP_WORDS[word] = true;});

const PREDICATES_TO_IGNORE = {
  'http://www.ft.com/ontology/annotation/hasAuthor' : true,
};

const ANNOTATIONS_TO_IGNORE = {
  "http://api.ft.com/things/9b40e89c-e87b-3d4f-b72c-2cf7511d2146": "GENRE:News",
};

function calcFreqOfNonStopWords(text){
  const minusTags = removeTags(text);
  const lowerCase = minusTags.toLowerCase();
  const minusNonAlpha = lowerCase
      .replace(/[^a-z’\-é]/g, ' ')
      .replace(/’s/g, '')
      .replace(/’\s/g,  ' ')
      ;
  const words = minusNonAlpha.trim().split(/\s+/);
  const wordCounts = {};
  words.forEach( word => {
    wordCounts[word] = (wordCounts.hasOwnProperty(word))? wordCounts[word] + 1 : 1;
  });
  const uniqueWordsMinusStops = Object.keys(wordCounts).filter( word => { return ! STOP_WORDS.hasOwnProperty(word); } ).sort();
  let maxWordCount = 0;
  uniqueWordsMinusStops.forEach( word => {
    maxWordCount = Math.max( maxWordCount, wordCounts[ word ] );
  } );
  const countsWords = {};
  for (var i = 1; i <= maxWordCount; i++) {
    countsWords[i] = [];
  }
  uniqueWordsMinusStops.forEach( word => {
    countsWords[ wordCounts[word] ].push( word );
  } );
  Object.keys(countsWords).forEach( index => {
    countsWords[index].sort();
  });

  return {
    description: "Looking for signals in the text. Perhaps low frequency words are important? Perhaps num of 'the's can help scale things a bit?",
    count : {
      totalChars : minusTags.length,
      the : (wordCounts.hasOwnProperty('the'))? wordCounts['the'] : 0,
      words : words.length,
      uniqueWords : Object.keys(wordCounts).length,
      uniqueWordsMinusStops : uniqueWordsMinusStops.length,
      uniqueStops : Object.keys(wordCounts).length - uniqueWordsMinusStops.length,
    },
    texts : {
      countsNonStopWords : countsWords,
      allNonStopWords : uniqueWordsMinusStops,
      allWordCounts : wordCounts,
      allWords : words,
      // lowerCase,
      // minusNonAlpha,
      // minusTags,
      raw: text,
    }
  }
}

const CACHE = new SimpleCache();

class Signature {
  constructor( sources, annotations, wordStats, score ){
    this.titles      = [].concat.apply([], sources.map(s => s.titles)); // flatten list of list of titles
    this.score       = score;
    this.annotations = annotations;
    this.wordStats   = wordStats;
    this.sources     = sources;
  }

  static CreateByUuid(uuid){
    const cachedSig = CACHE.read( uuid );
    if (cachedSig !== undefined) {
      debug(`CreateByUuid: cache hit: uuid=${uuid}}`);
      return Promise.resolve(cachedSig);
    }

    return Article.articleByUUID(uuid)
    .then( article => {
      const source = {
        titles: [`${article.title}(${article.publishedDate})`],
        type: 'article',
        id: uuid,
        data: article,
        pubishedDates: {
          from : article.publishedDate,
          to   : article.publishedDate,
          // range...
        }
      }

      const byId = {};
      const knownPredicates = {};

      article.annotations.forEach( annotation => {
        byId[annotation.id] = annotation;
        const predicate = annotation.predicate;
        if (ANNOTATIONS_TO_IGNORE[annotation.id] || PREDICATES_TO_IGNORE[predicate]) {
          return;
        }
        if (! knownPredicates.hasOwnProperty(predicate)) {
          knownPredicates[predicate] = {};
        }
        knownPredicates[predicate][annotation.id] = `${annotation.type}:${annotation.prefLabel}`;
      });

      const wordStats = calcFreqOfNonStopWords(article.bodyXML);

      const annotations = {
        byPredicate : knownPredicates,
        byId,
      }

      const score = {
        amount : 1.0,
        description : 'default score for just one thingy',
      };

      const sig = new Signature([source], annotations, wordStats, score );
      CACHE.write(uuid, sig);
      return sig;
    })
    ;
  }

  static StopWordsList() { return STOP_WORDS_LIST; }

  static CompareAnnotations( sigs ){
    // calc overlap of annotations in each predicate
    // then calc overlap score

    const overlap = {
      description : sigs[0].annotations.description,
      score       : {},
      byPredicate : {},
      byId        : {},
    };

    // loop over all known predicates
    //   discard any non-overlapping predicates
    //   loop over annotations
    //     loop over remaining sigs
    //       discard any non-overlapping annotions
    //   populate non-empty predicates

    const allSigsPredicates = sigs.map( s => s.annotations.byPredicate );
    const allKnownPredicates = {};
    allSigsPredicates.forEach( sPreds => {
      Object.keys(sPreds).forEach( pred => {
        allKnownPredicates[pred] = allKnownPredicates.hasOwnProperty(pred)? allKnownPredicates[pred]+1 : 1;
      });
    });
    const predicates = Object.keys(allKnownPredicates);

    predicates.forEach( pred  => {
      overlap.byPredicate[pred] = {};
      const countPredicates = allSigsPredicates.filter( s => s.hasOwnProperty(pred) );
      if (countPredicates.length != sigs.length) {
        return;
      }
      const overlappingAnnotationsIds = Object.keys( allSigsPredicates[0][pred] ).filter( a => {
        const countAnnotations = allSigsPredicates.filter( s => s[pred].hasOwnProperty(a) );
        return (countAnnotations.length === sigs.length);
      });
      // debug(`CompareAnnotations: overlapping predicate=${pred}, overlappingAnnotationsIds=${JSON.stringify(overlappingAnnotationsIds)}`);
      // populate the overlap obj with this predicate
      if (overlappingAnnotationsIds.length > 0) {
        overlappingAnnotationsIds.forEach( annoId => {
          overlap.byPredicate[pred][annoId] = allSigsPredicates[0][pred][annoId];
          overlap.byId[annoId] = sigs[0].annotations.byId[annoId];
        });
      }
    });

    // calc score
    // get full set of predicates across all sigs
    // for each predicate
    //   calc avg num annotations per sig
    //   calc ratio of size of overlap to avg size
    // score = calc avg ratio across all predicates

    overlap.score.description = `the avg of each predicate's overlap`;

    const predicateOverlapRatios = [];
    predicates.forEach( pred => {
      const numAnnotationsPerSig = allSigsPredicates.map( sp => sp.hasOwnProperty(pred)? Object.keys(sp[pred]).length : 0 );
      const sumAnnotationsPerSig = numAnnotationsPerSig.reduce((acc, curr) => acc + curr);
      const avgAnnotationsPerSig = sumAnnotationsPerSig / sigs.length;
      const numOverlappingAnnotations = overlap.byPredicate.hasOwnProperty(pred)? Object.keys(overlap.byPredicate[pred]).length : 0 ;
      const ratioOverlapToAvg = numOverlappingAnnotations / avgAnnotationsPerSig;
      predicateOverlapRatios.push( ratioOverlapToAvg );
    });
    const sumPredicateOverlapRatios = predicateOverlapRatios.reduce((acc, curr) => acc + curr);
    const avgPredicateOverlapRatio = sumPredicateOverlapRatios / predicates.length;

    overlap.score.amount = avgPredicateOverlapRatio;
    overlap.score.details = {
      predicates,
      predicateOverlapRatios,
      sumPredicateOverlapRatios,
      avgPredicateOverlapRatio,
    };

    return overlap;
  }

  static CompareWordStats( sigs ){
    const allSigsWordStats = sigs.map( s => s.wordStats );

    const overlap = {
      description : allSigsWordStats[0].description,
      score       : {},
      // get nonStopWords for each sig

    };

    // calc overlap
    // ratio of overlap size to avg nsw set size

    const sigsNSWSizes = [];
    const allKnownNonStopWordsCounts = {};
    allSigsWordStats.forEach( ws => {
      const nonStopWords = ws.texts.allNonStopWords;
      sigsNSWSizes.push( nonStopWords.length );
      nonStopWords.forEach( w => {
        if (! allKnownNonStopWordsCounts.hasOwnProperty(w)) {
          allKnownNonStopWordsCounts[w] = 0;
        }
        allKnownNonStopWordsCounts[w] = allKnownNonStopWordsCounts[w] + 1;
      } );
    } );
    const sumSigsNSWSizes = sigsNSWSizes.reduce((acc, curr) => acc + curr);
    const avgSigsNSWSize = sumSigsNSWSizes / sigs.length;
    const overlappingNonStopWords = Object.keys( allKnownNonStopWordsCounts ).filter( w => allKnownNonStopWordsCounts[w] == sigs.length );
    const ratioOverlapToAvg = overlappingNonStopWords.length / avgSigsNSWSize;

    overlap.texts = { allNonStopWords : overlappingNonStopWords };
    overlap.score.amount = ratioOverlapToAvg;
    overlap.score.details = {
      sigsNSWSizes,
      avgSigsNSWSize,
      numOverlappingWords : overlappingNonStopWords.length,
      ratioOverlapToAvg,
    };

    return overlap;
  }

  static CalcScore( annotations, wordStats ){
    const avgScoreFromAnnotationsAndWordStats = (annotations.score.amount + wordStats.score.amount) / 2.0;
    return {
      amount : avgScoreFromAnnotationsAndWordStats,
      description : `avg of annotions and wordStats scores`,
      details : {
        annotations : annotations.score.amount,
        wordStats : wordStats.score.amount,
        avgScoreFromAnnotationsAndWordStats,
      }
    }
  }

  static MergeSigs( sigs ){
    const annotations = Signature.CompareAnnotations(sigs);
    const wordStats   = Signature.CompareWordStats(sigs);
    const score       = Signature.CalcScore(annotations, wordStats);

    const sig = new Signature(sigs, annotations, wordStats, score );
    return sig;
  }

  // take a list of uuids,
  // and create (or look up in cache) their combined signature,
  // by creating (or looking up in cache) the sig for each uuid,
  // then combining them
  static CreateByUuids( uuids ){
      // TBD: check uuids are valid

      if (uuids.length == 0) {
        return Promise.resolve({});
      }
      const cacheKey = uuids.join(',');
      const cachedUuidsItem = CACHE.read( cacheKey );
      if (cachedUuidsItem !== undefined) {
        debug(`createByUuids: cache hit: cacheKey=${cacheKey}}`);
        return Promise.resolve(cachedUuidsItem);
      } else if (uuids.length === 1) {
        return Signature.CreateByUuid(uuid);
      }

      const uuidPromises = uuids.map( uuid => Signature.CreateByUuid(uuid) );

      return Promise.all( uuidPromises )
      .then( sigs => Signature.MergeSigs( sigs ) )
      .then( mergedSig => {
        CACHE.write(cacheKey, mergedSig);
        return mergedSig;
      })
      ;
  }
}

module.exports = {
  byUuids : Signature.CreateByUuids,
  byUuid  : Signature.CreateByUuid,
}
