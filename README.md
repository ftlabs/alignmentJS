# FT Labs - alignmentJS

Experiments in search results. See the root page for endpoints.

(used template_SAPI)

### Installation

Configure the mandatory env params, either in SHELL or .env file:

* CAPI_KEY=...
* TOKEN=... # for auth'ed access w/o S3O or IP range. Can be set to noddy value for dev.
* PORT=... # auto set in Heroku, but needs specifying for dev

Install the dependencies and start the server. The server will watch for any changes made and automatically restart.

```sh
$ npm install
$ npm start
```

For tests, run:

```sh
$ npm test
```

### Configuration

Optional env params

* CAPI_CONCURRENCE=... (default=4)
* DEFAULT_TERM=...     (default=brexit)
* DEFAULT_YEAR=...     (default=2017')
