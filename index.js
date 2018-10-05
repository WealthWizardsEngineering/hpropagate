'use strict'

const http = require('http')
const uuid = require('uuid')
const tracer = require('./tracer')

const originalHttpCreateServer = http.createServer
const originalRequest = http.request

function wrappedListener(listener) {

    return (req, res, next) => {

        tracer.newTrace('httpRequest')

        let correlationId = req.headers['x-correlation-id']
        if (typeof correlationId === 'undefined') {
            correlationId = uuid.v4()
        }

        tracer.currentTrace.context.set('correlationId', correlationId)
        res.setHeader('X-Correlation-ID', correlationId)

        listener.call(null, req, res, next)
    }
}

function wrappedHttpCreateServer(listener) { // args are ([options<Object>], [listener<Fn>]) Express only sends listener

    return originalHttpCreateServer(wrappedListener(listener))
}

function wrappedHttpRequest(options, cb) {

    options.headers['x-correlation-id'] = tracer.currentTrace.context.get('correlationId')

    return originalRequest.call(null, options, cb)
}

http['createServer__original'] = originalHttpCreateServer
http['createServer'] = wrappedHttpCreateServer
http['request__original'] = originalRequest
http['request'] = wrappedHttpRequest
