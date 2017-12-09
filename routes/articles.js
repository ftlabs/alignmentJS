const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');
const Signature = require('../modules/Signature');
const Signature2 = require('../modules/SignatureClass');
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
  Signature.uuid(uuid).then(signature => {
      res.json(signature);
  }).catch(e => {
      next(e);
  })
});

router.get('/signature/compare', (req, res, next) => {
  const uuid1 = req.query.uuid1;
  const uuid2 = req.query.uuid2;
  Signature.compare(uuid1, uuid2).then(comparison => {
      res.json(comparison);
  }).catch(e => {
      next(e);
  })
});

router.get('/signature2', (req, res, next) => {
  const uuid = req.query.uuid;
  Signature2.byUuid(uuid).then(signature => {
      res.json(signature);
  }).catch(e => {
      next(e);
  })
});

router.get('/signature2/compare', (req, res, next) => {
  const uuid1 = req.query.uuid1;
  const uuid2 = req.query.uuid2;
  Signature2.byUuids([uuid1, uuid2]).then(comparison => {
      res.json(comparison);
  }).catch(e => {
      next(e);
  })
});

module.exports = router;
