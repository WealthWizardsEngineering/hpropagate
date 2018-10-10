'use strict'

const http = require('http')
const uuid = require('uuid')
const tracer = require('./tracer')

const originalHttpCreateServer = http.createServer
const originalRequest = http.request

function setAndPropagateCorrelationId(req, res) {
    let correlationId = req.headers['x-correlation-id']
    if (typeof correlationId === 'undefined') {
        correlationId = uuid.v4()
    }
    tracer.currentTrace.context.set('x-correlation-id', correlationId)
    res.setHeader('x-correlation-id', correlationId)
}

function propagate(req, ...headers) {
    headers.forEach(header => {
        if (typeof req.headers[header] !== 'undefined') {
            tracer.currentTrace.context.set(header, req.headers[header])
        }
    })
}

function inject(options, ...headers) {
    console.log("DEBUG injecting headers for call to ", options.url)
    headers.forEach(header => {
        if (tracer.currentTrace.context.has(header)) {
            console.log("DEBUG injecting ", header, " with ", tracer.currentTrace.context.get(header))
            options.headers[header] = tracer.currentTrace.context.get(header)
        }
    })
}

function wrappedListener(listener) {

    return (req, res, next) => {

        tracer.newTrace('httpRequest')

        setAndPropagateCorrelationId(req, res)

        propagate(req,
            'x-request-id',
            'x-b3-traceid',
            'x-b3-spanid',
            'x-b3-parentspanid',
            'x-b3-sampled',
            'x-b3-flags',
            'x-ot-span-context',
            'x-variant-id')

        listener.call(null, req, res, next)
    }
}

function wrappedHttpCreateServer(listener) { // args are ([options<Object>], [listener<Fn>]) Express only sends listener

    return originalHttpCreateServer(wrappedListener(listener))
}

function wrappedHttpRequest(options, cb) {

    inject(options,
        'x-correlation-id',
        'x-request-id',
        'x-b3-traceid',
        'x-b3-spanid',
        'x-b3-parentspanid',
        'x-b3-sampled',
        'x-b3-flags',
        'x-ot-span-context',
        'x-variant-id'
    )

    return originalRequest.call(null, options, cb)
}

http['createServer__original'] = originalHttpCreateServer
http['createServer'] = wrappedHttpCreateServer
http['request__original'] = originalRequest
http['request'] = wrappedHttpRequest
