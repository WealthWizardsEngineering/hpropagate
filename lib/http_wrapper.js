'use strict'

const http = require('http')
const uuid = require('uuid')
const tracer = require('./tracer')
const config = require('./config')

const originalHttpCreateServer = http.createServer
const originalRequest = http.request

function wrapHttp () {
  http['createServer__original'] = originalHttpCreateServer
  http['createServer'] = wrappedHttpCreateServer
  http['request__original'] = originalRequest
  http['request'] = wrappedHttpRequest
}

function setAndCollectCorrelationId (req, res) {
  let correlationId = req.headers[config.correlationIdHeader]
  if (typeof correlationId === 'undefined') {
    correlationId = uuid.v4()
  }
  tracer.currentTrace.context.set(config.correlationIdHeader, correlationId)
  res.setHeader(config.correlationIdHeader, correlationId)
}

function collect (req, headers) {
  headers.forEach(header => {
    if (typeof req.headers[header] !== 'undefined') {
      tracer.currentTrace.context.set(header, req.headers[header])
    }
  })
}

function inject (options, headers) {
  headers.forEach(header => {
    if (tracer.currentTrace.context.has(header)) {
      options.headers[header] = tracer.currentTrace.context.get(header)
    }
  })
}

function wrappedListener (listener) {
  return (req, res, next) => {
    tracer.newTrace('httpRequest')

    setAndCollectCorrelationId(req, res)

    collect(req, config.headersToCollect)

    listener(req, res, next)
  }
}

function wrappedHttpCreateServer (listener) { // args are ([options<Object>], [listener<Fn>]) Express only sends listener
  return originalHttpCreateServer(wrappedListener(listener))
}

function wrappedHttpRequest (options, cb) {
  inject(options, config.headersToInject)

  return originalRequest(options, cb)
}

module.exports = { wrapHttp }
