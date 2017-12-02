const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');
const debug = require('debug')('routes:articles');

router.get('/search/:searchTerm', (req, res, next) => {
        Article.searchByTerm(req.params.searchTerm).then(articles => {
            res.json(articles);
        }).catch(e => {
            next(e);
    })
});

router.get('/searchTitlesInYear/:searchTerm/:year', (req, res, next) => {
  Article.searchTitlesInYear(req.params.searchTerm, req.params.year).then(articles => {
      res.json(articles);
  }).catch(e => {
      next(e);
  })
});

router.get('/alignTitlesInYear/:searchTerm/:year', (req, res, next) => {
  const searchterm = req.params.searchTerm;
  const year       = req.params.year;
  Article.alignTitlesInYear(searchterm, year).then(results => {
    res.json(results);
  }).catch(e => {
    next(e);
  })
});

router.get('/alignTitlesInYear/:searchTerm/:year/display', (req, res, next) => {
  const searchterm = req.params.searchTerm;
  const year       = req.params.year;
  Article.alignTitlesInYear(searchterm, year).then(results => {
    res.render('alignedTitles', results);
  }).catch(e => {
      next(e);
  })
});

module.exports = router;
