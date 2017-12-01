# FT Labs - template_SAPI

Base project containing the barebones files to get started with SAPI requests and FT SSO.
### Installation

Configure the env params, either in SHELL or .env file:

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
