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

const SIGNATURE_CACHE = new SimpleCache();

function signature(uuid) {

  const cachedSigItem = SIGNATURE_CACHE.read( uuid );
  if (cachedSigItem !== undefined) {
    debug(`signature: cache hit: uuid=${uuid}}`);
    return Promise.resolve(cachedSigItem);
  }

  return Article.articleByUUID(uuid)
  .then( article => {
    const signature = {
      uuid,
      title : article.title,
    };

    const byId = {};
    const knownPredicates = {};

    article.annotations.forEach( annotation => {
      byId[annotation.id] = annotation;
      const predicate = annotation.predicate;
      if (! knownPredicates.hasOwnProperty(predicate)) {
        knownPredicates[predicate] = {};
      }
      knownPredicates[predicate][annotation.id] = `${annotation.type}:${annotation.prefLabel}`;
    });

    signature.wordStats = calcFreqOfNonStopWords(article.bodyXML);

    signature.annotations = {
      byPredicate : knownPredicates,
      byId,
    }

    SIGNATURE_CACHE.write(uuid, signature);

    return signature;
  })
  ;
}

function comparePredicates( sig0, sig1 ){
  const overlappingPredicates = {};
  const sig0ByPredicate = sig0.annotations.byPredicate;
  const sig1ByPredicate = sig1.annotations.byPredicate;
  Object.keys(sig0ByPredicate).forEach( predicate => {
    if (sig1ByPredicate.hasOwnProperty( predicate )) {
      const overlappingIds = {};
      Object.keys(sig0ByPredicate[predicate]).forEach( id => {
        if (sig0ByPredicate[predicate].hasOwnProperty(id)) {
          overlappingIds[id] = sig0ByPredicate[predicate][id];
        }
      });
      if (Object.keys(overlappingIds).length > 0) {
        overlappingPredicates[predicate] = overlappingIds;
      }
    }
  })

  return {
    description : 'For each predicate (aka type of annotation), we look for the same ids (and readable name, aka type:prefLabel) in both signatures.',
    overlaps: overlappingPredicates
  }
}

function compare(uuid0, uuid1){
  const sigPromises = [signature(uuid0), signature(uuid1)];
  return Promise.all( sigPromises )
  .then( sigs => {

    const comparison = {
      predicates : comparePredicates(sigs[0], sigs[1]),
      deltas : {
        UniqueWordsMinusStops : Math.abs( sigs[0].wordStats.count.uniqueWordsMinusStops - sigs[1].wordStats.count.uniqueWordsMinusStops ),
      }
    };

    return comparison;
  })
  ;
}

module.exports = {
  uuid : signature,
  compare
}
