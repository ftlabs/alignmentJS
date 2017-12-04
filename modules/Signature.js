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

function calcFreqOfNonStopWords(text){
  const minusTags = removeTags(text);
  const minusNonAlpha = minusTags.replace(/[^a-zA-Z’\-]/g, ' ');
  const lowerCase = minusNonAlpha.toLowerCase();
  const words = lowerCase.trim().split(/\s+/);
  const wordCounts = {};
  words.forEach( word => {
    wordCounts[word] = (wordCounts.hasOwnProperty(word))? wordCounts[word] + 1 : 1;
  });
  const countsWords = {
    1 : [],
    2 : [],
    3 : [],
    many : [],
  };
  Object.keys(wordCounts).forEach( word => {
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
    count : {
      totalChars : minusTags.length,
      the : (wordCounts.hasOwnProperty('the'))? wordCounts['the'] : 0,
      words : words.length,
      uniqueWords : Object.keys(wordCounts).length,
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
