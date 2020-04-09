const dotenv = require('dotenv').config({ silent: process.env.NODE_ENVIRONMENT === 'production' });
const package = require('./package.json');
const debug = require('debug')(`suggest:index`);
const express = require('express');
const path = require('path');
const app = express();
const articles = require('./routes/articles');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');


var requestLogger = function (req, res, next) {
  debug("RECEIVED REQUEST:", req.method, req.url);
  next(); // Passing the request to the next handler in the stack.
}

const session = require('cookie-session');
const OktaMiddleware = require('@financial-times/okta-express-middleware');
const okta = new OktaMiddleware({
  client_id: process.env.OKTA_CLIENT,
  client_secret: process.env.OKTA_SECRET,
  issuer: process.env.OKTA_ISSUER,
  appBaseUrl: process.env.BASE_URL,
  scope: 'openid offline_access name'
});

app.use(session({
	secret: process.env.SESSION_TOKEN,
	maxAge: 24 * 3600 * 1000, //24h
	httpOnly: true
}));

app.use(requestLogger);

// these routes do *not* have OKTA
app.use('/static', express.static('static'));

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  throw new Error('ERROR: TOKEN not specified in env');
}

// these route *do* use OKTA
app.set('json spaces', 2);


// Check for valid OKTA login or valid token to byass OKTA login
// This function is not in a middleware or seperate file because
// it requires the context of okta and app.use to function
app.use((req, res, next) => {
  if ('token' in req.headers){
	   if(req.headers.token === process.env.TOKEN){
		     debug(`Token (header) was valid.`);
		     next();
       } else {
         debug(`The token (header) value passed was invalid.`);
         res.status(401);
         res.json({
           status : 'err',
           message : 'The token (header) value passed was invalid.'
         });
       }
  } else if('token' in req.query ){
    if(req.query.token === process.env.TOKEN){
      debug(`Token (query string) was valid.`);
		  next();
    } else {
      debug(`The token (query) value passed was invalid.`);
      res.status(401);
      res.json({
        status : 'err',
        message : 'The token (query) value passed was invalid.'
      });
    }
  } else {
    debug(`No token in header or query, so defaulting to OKTA`);
		// here to replicate multiple app.uses we have to do
		// some gross callback stuff. You might be able to
    // find a nicer way to do this

		// This is the equivalent of calling this:
		// app.use(okta.router);
		// app.use(okta.ensureAuthenticated());
    // app.use(okta.verifyJwts());

		okta.router(req, res, error => {
			if (error) {
				return next(error);
      }
			okta.ensureAuthenticated()(req, res, error => {
				if (error) {
					return next(error);
        }
				okta.verifyJwts()(req, res, next);
      });
    });
  }
});

//Core Routes
app.use('/articles', articles);

// ---

app.use('/', (req, res) => {
  res.render('index');
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

//---

function startListening() {
  app.listen(process.env.PORT, function () {
    console.log('Server is listening on port', process.env.PORT);
  });
}
//---
startListening();

module.exports = app;
