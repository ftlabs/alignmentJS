const express = require('express');
const router = express.Router();
const Article = require('../modules/Article');

router.get('/search/:searchTerm', (req, res, next) => {
        Article.searchByTerm(req.params.searchTerm).then(articles => {
            res.json(articles);
        }).catch(e => {
            next(e);
    })
});

router.get('/searchTitlesInYear/:searchTerm/:year', (req, res, next) => {
  const searchParams = {
  		queryString : ``,
  	   maxResults : 100,
  		     offset : 0,
  			  aspects : [ "title"], // [ "title", "location", "summary", "lifecycle", "metadata"],
  		constraints : [
        `title:${req.params.searchTerm}`,
        `lastPublishDateTime:>${req.params.year}-01-01T00:00:00Z`,
        `lastPublishDateTime:<${req.params.year}-12-31T23:59:59Z`,
      ],
  	       facets : {"names":[], "maxElements":-1}
  	};

  Article.searchByParams(searchParams).then(articles => {
      res.json(articles);
  }).catch(e => {
      next(e);
  })
});


module.exports = router;
