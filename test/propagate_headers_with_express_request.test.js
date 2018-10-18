'use strict'

// Needed to instrument the http module
require('../index')
const test = require('tape')
const http = require('http')
const supertest = require('supertest')
const express = require('express')
const request = require('request')

const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

const app = express()

// Simple Express app that makes a call to a outbound service
// to prove that we propagate headers (using the request module)
app.get('/', (req, res) => {
  request('http://localhost:8888/', (error, response, body) => {
    if (error || response.statusCode !== 200) {
      res.status(500).send('boom')
      return
    }
    res.status(200).send('successful')
  })
})

// Simple HTTP service created with the original (not instrumented)
// http server. We'll use it to assert that the headers are properly propagated
// We can't use nock here or any other modules that intercept http calls as they
// usually bypass the instrumentation (never actually makes the http call)
async function withOutboundService (fn) {
  const outboundService = await http.createServer__original((req, res) => {
    res.writeHead(200)
    res.end('ok')
  }).listen(8888)

  try {
    await fn(outboundService)
  } finally {
    outboundService.close()
  }
}

test('should propagate correlation id if received on request', assert => {
  assert.plan(3)

  const correlationId = 'my-correlation-id'

  withOutboundService(async (service) => {
    // we can intercept the outbound request to assert that the headers
    // are properly propagated
    service.on('request', (req) => {
      assert.equal(req.headers['x-correlation-id'], correlationId)
    })

    const response = await supertest(app)
      .get('/')
      .set('x-correlation-id', correlationId)

    assert.equal(response.statusCode, 200)
    assert.equal(correlationId, response.headers['x-correlation-id'])
  })
})

test('should set and propagate correlation id if not received on request', assert => {
  assert.plan(3)

  withOutboundService(async (service) => {
    let outboundCorrelationId
    service.on('request', (req) => {
      outboundCorrelationId = req.headers['x-correlation-id']
    })

    const response = await supertest(app).get('/')

    assert.equal(response.statusCode, 200)
    assert.ok(uuidRegex.test(response.headers['x-correlation-id']))
    assert.equal(outboundCorrelationId, response.headers['x-correlation-id'])
  })
})

test('should propagate tracing headers and variant id', assert => {
  assert.plan(9)

  withOutboundService(async (service) => {
    service.on('request', (req) => {
      assert.equal(req.headers['x-request-id'], 'request-id')
      assert.equal(req.headers['x-b3-traceid'], 'trace-id')
      assert.equal(req.headers['x-b3-spanid'], 'span-id')
      assert.equal(req.headers['x-b3-parentspanid'], 'parent-span-id')
      assert.equal(req.headers['x-b3-sampled'], 'sampled')
      assert.equal(req.headers['x-b3-flags'], 'flags')
      assert.equal(req.headers['x-ot-span-context'], 'span-context')
      assert.equal(req.headers['x-variant-id'], 'variant-id')
    })

    const response = await supertest(app)
      .get('/')
      .set('x-request-id', 'request-id')
      .set('x-b3-traceid', 'trace-id')
      .set('x-b3-spanid', 'span-id')
      .set('x-b3-parentspanid', 'parent-span-id')
      .set('x-b3-sampled', 'sampled')
      .set('x-b3-flags', 'flags')
      .set('x-ot-span-context', 'span-context')
      .set('x-variant-id', 'variant-id')

    assert.equal(response.statusCode, 200)
  })
})
