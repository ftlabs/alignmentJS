const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');
const debug = require('debug')('routes:articles');

router.get('/search/:searchTerm', (req, res, next) => {
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

module.exports = router;
