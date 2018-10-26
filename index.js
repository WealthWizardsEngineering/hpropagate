const config = require('./lib/config');
const tracer = require('./lib/tracer');
const httpWrapper = require('./lib/http_wrapper');

module.exports = overrides => {
  httpWrapper.wrapHttp(config.load(overrides));

  tracer.enable();
};
