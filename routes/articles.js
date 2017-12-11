const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');
const Signature = require('../modules/Signature');
const Suggest = require('../modules/Suggest');
const fetchContent = require('../lib/fetchContent');
const debug = require('debug')('routes:articles');

router.get('/search', (req, res, next) => {
  const term = req.query.term;
  Article.searchByTerm(term).then(articles => {
      res.json(articles);
  }).catch(e => {
      next(e);
  })
});

router.get('/searchTitlesInYear', (req, res, next) => {
  const term = req.query.term;
  const year = req.query.year;
  Article.searchTitlesInYear(term, year).then(articles => {
      res.json(articles);
  }).catch(e => {
      next(e);
  })
});

router.get('/alignTitlesInYear', (req, res, next) => {
  const term = req.query.term;
  const year = req.query.year;
  Article.alignTitlesInYear(term, year).then(results => {
    res.json(results);
  }).catch(e => {
    next(e);
  })
});

router.get('/alignTitlesInYear/display', (req, res, next) => {
  const term = req.query.term;
  const year = req.query.year;
  Article.alignTitlesInYear(term, year).then(results => {
    res.render('alignedTitles', results);
  }).catch(e => {
      next(e);
  })
});

router.get('/lookup', (req, res, next) => {
  const uuid = req.query.uuid;
  Article.articleByUUID(uuid).then(article => {
      res.json(article);
  }).catch(e => {
      next(e);
  })
});

router.get('/signature', (req, res, next) => {
  const uuid = req.query.uuid;
  Signature.byUuid(uuid).then(signature => {
      res.json(signature);
  }).catch(e => {
      next(e);
  })
});

router.get('/signature/:uuidCsv', (req, res, next) => {
  const uuidCsv = req.params.uuidCsv;
  const extraUuid = req.query.uuid;

  const uuids = (uuidCsv !== undefined && uuidCsv !== '')? uuidCsv.split(',') : [];
  if (extraUuid !== undefined && extraUuid !== '') {
    uuids.push(extraUuid);
  }
  debug(`/signature/:uuidCsv : uuidCsv=${uuidCsv}, extraUuid=${extraUuid}, uuids=${JSON.stringify(uuids)}`);

  Signature.byUuids(uuids).then(comparison => {
      res.json(comparison);
  }).catch(e => {
      next(e);
  })
});

router.get('/v2Lookup', (req, res, next) => {
  const url = req.query.url;
  fetchContent.v2ApiCall(url).then(body => {
      res.json(body);
  }).catch(e => {
      next(e);
  })
});

router.get('/v2v1Concordance', (req, res, next) => {
  const url = req.query.url;
  fetchContent.v2v1Concordance(url).then(body => {
      res.json(body);
  }).catch(e => {
      next(e);
  })
});

router.get('/tmeIdOfV2Annnotation', (req, res, next) => {
  const url = req.query.url;
  fetchContent.tmeIdOfV2Annnotation(url).then(body => {
      res.json(body);
  }).catch(e => {
      next(e);
  })
});

router.get('/searchEntityDateRange', (req, res, next) => {
  const ontology = req.query.ontology;
  const id       = req.query.id;
  const fromDate = req.query.fromDate;
  const toDate   = req.query.toDate;
  Article.searchEntityDateRange(ontology, id, fromDate, toDate)
  .then(body => {
      res.json(body);
  }).catch(e => {
      next(e);
  })
});

router.get('/suggest/between/:uuidCsv', (req, res, next) => {
  const uuidCsv = req.params.uuidCsv;

  const uuids = (uuidCsv !== undefined && uuidCsv !== '')? uuidCsv.split(',') : [];
  debug(`/suggest/between/:uuidCsv : uuids=${JSON.stringify(uuids)}`);

  Suggest.between(uuids)
  .then(articles => {
      res.json(articles);
  }).catch(e => {
      next(e);
  })
});

router.get('/suggest/between/:uuidCsv/tabulated', (req, res, next) => {
  const uuidCsv = req.params.uuidCsv;

  const uuids = (uuidCsv !== undefined && uuidCsv !== '')? uuidCsv.split(',') : [];
  debug(`/suggest/between/:uuidCsv/tabulated : uuids=${JSON.stringify(uuids)}`);

  Suggest.betweenTabulated(uuids)
  .then(tabulated => {
    res.json(tabulated);
  }).catch(e => {
    next(e);
  })
});

router.get('/suggest/between/tabulated/display', (req, res, next) => {
  const uuidVal = (req.query.uuid !== undefined)? req.query.uuid : ['2ebe9c54-d82e-11e7-a039-c64b1c09b482','d068d0b8-d529-11e7-8c9a-d9c0a5c8d5c9'];
  const uuidsRaw = (Array.isArray(uuidVal))? uuidVal : [uuidVal];
  const uuids = uuidsRaw.filter(uuid => (uuid !== ''));
  debug(`/suggest/between/tabulated/display: uuids=${JSON.stringify(uuids)}`);

  Suggest.betweenTabulated(uuids)
  .then(tabulatedArticles => {
      res.render('tabulatedSuggestionsWithForm', tabulatedArticles);
  }).catch(e => {
    next(e);
  })
});

module.exports = router;
