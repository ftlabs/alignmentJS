// const fetchContent = require('../lib/fetchContent');
const directly = require('../helpers/directly');
const Signature = require('./Signature');
const SimpleCache = require('../helpers/simple-cache');
const debug = require('debug')('modules:Suggest');

function defaultValueIfNotSet(currentVal, defaultVal){
  return (currentVal === null || currentVal === undefined)? defaultVal : currentVal;
}

// calc date range of uuids
// calc combined sig of articles
// map from v2 annotations to v1 ids that work with SAPI
// search each annotation, within date range, for uuids
// calc sig score for each uuid with combined sig
// group by week(?)
// sort by score
function suggestBetween( uuids ){
  const combinedSig = SignaturebyUuids( uuids );

}

module.exports = {
  between : suggestBetween,
  // before : suggestBefore,
  // after : suggestAfter,
}
