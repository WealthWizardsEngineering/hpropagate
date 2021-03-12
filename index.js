const config = require('./lib/config');
const tracer = require('./lib/tracer');
const httpWrapper = require('./lib/http_wrapper');

const init = overrides => {
  const configuration = config.load(overrides);
  httpWrapper.wrapHttp(configuration);
  httpWrapper.wrapHttps(configuration);

  tracer.enable();
};

const getHeader = name => tracer.currentTrace.context.get(name);

module.exports = Object.assign(init, { getHeader });
