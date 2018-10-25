const http = require('http');
const uuid = require('uuid');
const tracer = require('./tracer');

const originalHttpCreateServer = http.createServer;
const originalRequest = http.request;

function setAndCollectCorrelationId(config, req, res) {
  let correlationId = req.headers[config.correlationIdHeader];
  if (typeof correlationId === 'undefined') {
    correlationId = uuid.v4();
  }
  tracer.currentTrace.context.set(config.correlationIdHeader, correlationId);
  res.setHeader(config.correlationIdHeader, correlationId);
}

function collect(req, headers) {
  headers.forEach(header => {
    if (typeof req.headers[header] !== 'undefined') {
      tracer.currentTrace.context.set(header, req.headers[header]);
    }
  });
}

function wrappedListener(config, listener) {
  return (req, res, next) => {
    tracer.newTrace('httpRequest');

    if (config.setAndPropagateCorrelationId === true) {
      setAndCollectCorrelationId(config, req, res);
    }

    collect(req, config.headersToCollect);

    listener(req, res, next);
  };
}

function wrapHttpCreateServer(config) {
  // args of http.createServer are ([options<Object>], [listener<Fn>]) Express only sends listener
  return function _wrappedHttpCreateServer(listener) {
    return originalHttpCreateServer(wrappedListener(config, listener));
  };
}

function inject(options, headers) {
  if (tracer.currentTrace) {
    headers.forEach(header => {
      if (tracer.currentTrace.context.has(header)) {
        // eslint-disable-next-line no-param-reassign
        options.headers[header] = tracer.currentTrace.context.get(header);
      }
    });
  }
}

function wrapHttpRequest(config) {
  return function _wrappedHttpRequest(options, cb) {
    inject(options, config.headersToInject);

    return originalRequest(options, cb);
  };
}

function wrapHttp(config) { // args ([options<Object>])
  http.createServer__original = originalHttpCreateServer;
  http.createServer = wrapHttpCreateServer(config);
  http.request__original = originalRequest;
  http.request = wrapHttpRequest(config);
}

module.exports = { wrapHttp };
