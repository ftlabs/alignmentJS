// const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const Article = require('./Article');
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

const STOP_WORDS_LIST = ["a", "about", "above", "above", "across", "after", "afterwards", "again", "against", "all", "almost", "alone", "along", "already", "also","although","always","am","among", "amongst", "amoungst", "amount",  "an", "and", "another", "any","anyhow","anyone","anything","anyway", "anywhere", "are", "around", "as",  "at", "back","be","became", "because","become","becomes", "becoming", "been", "before", "beforehand", "behind", "being", "below", "beside", "besides", "between", "beyond", "bill", "both", "bottom","but", "by", "call", "can", "cannot", "cant", "co", "con", "could", "couldnt", "cry", "de", "describe", "detail", "do", "done", "down", "due", "during", "each", "eg", "eight", "either", "eleven","else", "elsewhere", "empty", "enough", "etc", "even", "ever", "every", "everyone", "everything", "everywhere", "except", "few", "fifteen", "fify", "fill", "find", "fire", "first", "five", "for", "former", "formerly", "forty", "found", "four", "from", "front", "full", "further", "get", "give", "go", "had", "has", "hasnt", "have", "he", "hence", "her", "here", "hereafter", "hereby", "herein", "hereupon", "hers", "herself", "him", "himself", "his", "how", "however", "hundred", "ie", "if", "in", "inc", "indeed", "interest", "into", "is", "it", "its", "itself", "keep", "last", "latter", "latterly", "least", "less", "ltd", "made", "many", "may", "me", "meanwhile", "might", "mill", "mine", "more", "moreover", "most", "mostly", "move", "much", "must", "my", "myself", "name", "namely", "neither", "never", "nevertheless", "next", "nine", "no", "nobody", "none", "noone", "nor", "not", "nothing", "now", "nowhere", "of", "off", "often", "on", "once", "one", "only", "onto", "or", "other", "others", "otherwise", "our", "ours", "ourselves", "out", "over", "own","part", "per", "perhaps", "please", "put", "rather", "re", "same", "see", "seem", "seemed", "seeming", "seems", "serious", "several", "she", "should", "show", "side", "since", "sincere", "six", "sixty", "so", "some", "somehow", "someone", "something", "sometime", "sometimes", "somewhere", "still", "such", "system", "take", "ten", "than", "that", "the", "their", "them", "themselves", "then", "thence", "there", "thereafter", "thereby", "therefore", "therein", "thereupon", "these", "they", "thickv", "thin", "third", "this", "those", "though", "three", "through", "throughout", "thru", "thus", "to", "together", "too", "top", "toward", "towards", "twelve", "twenty", "two", "un", "under", "until", "up", "upon", "us", "very", "via", "was", "we", "well", "were", "what", "whatever", "when", "whence", "whenever", "where", "whereafter", "whereas", "whereby", "wherein", "whereupon", "wherever", "whether", "which", "while", "whither", "who", "whoever", "whole", "whom", "whose", "why", "will", "with", "within", "without", "would", "yet", "you", "your", "yours", "yourself", "yourselves", "the"];

const STOP_WORDS = {};
STOP_WORDS_LIST.forEach( word => { STOP_WORDS[word] = true;});

function calcFreqOfNonStopWords(text){
  const minusTags = removeTags(text);
  const lowerCase = minusTags.toLowerCase();
  const minusNonAlpha = lowerCase
      .replace(/[^a-z’\-é]/g, ' ')
      .replace(/’s/g, '')
      .replace(/’\s/g,  ' ')
      .replace(/\bi\b/g,  '')
      ;
  const words = minusNonAlpha.trim().split(/\s+/);
  const wordCounts = {};
  words.forEach( word => {
    wordCounts[word] = (wordCounts.hasOwnProperty(word))? wordCounts[word] + 1 : 1;
  });
  const uniqueWordsMinusStops = Object.keys(wordCounts).filter( word => { return ! STOP_WORDS.hasOwnProperty(word); } );
  const countsWords = {
    1 : [],
    2 : [],
    3 : [],
    many : [],
  };
  uniqueWordsMinusStops.forEach( word => {
    if (wordCounts[word] <= 3) {
      countsWords[ wordCounts[word] ].push( word );
    } else {
      countsWords.many.push( word );
    }
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
      countsWords,
      wordCounts,
      words,
      lowerCase,
      minusNonAlpha,
      minusTags,
      raw: text,
    }
  }
}

function uuid(uuid) {
    return Article.articleByUUID(uuid)
    .then( article => {
      const signature = {
        uuid,
        title : article.title,
      };

      const knownPredicates = {};

      article.annotations.forEach( annotation => {
        const predicate = annotation.predicate;
        if (! knownPredicates.hasOwnProperty(predicate)) {
          knownPredicates[predicate] = [];
        }
        knownPredicates[predicate].push(annotation);
      });

      signature.wordStats = calcFreqOfNonStopWords(article.bodyXML);

      signature.annotations = {
        byPredicates : knownPredicates,
      }

      return signature;
    })
    ;
}


module.exports = {
  uuid,
}
