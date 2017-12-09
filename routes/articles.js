const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');
const Signature = require('../modules/Signature');
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


module.exports = router;
