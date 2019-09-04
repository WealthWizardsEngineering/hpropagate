const http = require('http');
const uuid = require('uuid');
const tracer = require('./tracer');

const originalHttpCreateServer = http.createServer;
const originalRequest = http.request;
const originalGet = http.get;

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

function injectInResponse(response, headers) {
  if (tracer.currentTrace) {
    headers.forEach(header => {
      if (tracer.currentTrace.context.has(header)) {
        // eslint-disable-next-line no-param-reassign
        response.setHeader(header, tracer.currentTrace.context.get(header));
      }
    });
  }
}

function wrappedListener(config, listener) {
  return (req, res, next) => {
    tracer.newTrace('httpRequest');

    if (config.setAndPropagateCorrelationId === true) {
      setAndCollectCorrelationId(config, req, res);
    }

    collect(req, config.headersToCollect);

    if (config.propagateInResponses) {
      injectInResponse(res, config.headersToInject);
    }

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
    if (!options.headers) {
      // eslint-disable-next-line no-param-reassign
      options.headers = {};
    }

    headers.forEach(header => {
      if (tracer.currentTrace.context.has(header)) {
        // eslint-disable-next-line no-param-reassign
        options.headers[header] = tracer.currentTrace.context.get(header);
      }
    });
  }
}

function wrapHttpRequest(originalMethod, config) {
  function urlFirst(url, options, cb) {
    inject(options, config.headersToInject);

    return originalMethod(url, options, cb);
  }

  function optionsFirst(options, cb) {
    inject(options, config.headersToInject);

    return originalMethod(options, cb);
  }

  return function _wrappedHttpRequest(first, ...rest) {
    if (typeof first === 'string') {
      const [second] = rest;

      if (typeof second === 'function') {
        return urlFirst(first, {}, ...rest);
      }

      return urlFirst(first, ...rest);
    }

    return optionsFirst(first, ...rest);
  };
}

function wrapHttp(config) { // args ([options<Object>])
  http.createServer__original = originalHttpCreateServer;
  http.createServer = wrapHttpCreateServer(config);
  http.request__original = originalRequest;
  http.request = wrapHttpRequest(originalRequest, config);
  http.get__original = originalGet;
  http.get = wrapHttpRequest(originalGet, config);
}

module.exports = { wrapHttp };
