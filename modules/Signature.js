// const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const Article = require('./Article');
const debug = require('debug')('modules:Signature');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

// const DEFAULT_YEAR     = defaultValueIfNotSet(process.env.DEFAULT_YEAR, '2017');

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
