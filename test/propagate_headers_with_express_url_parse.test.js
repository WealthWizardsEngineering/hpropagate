// Needed to instrument the http module
const test = require('tape');
const http = require('http');
const supertest = require('supertest');
const express = require('express');
const url = require('url');
const hpropagate = require('../index');

const app = express();
hpropagate({
  headersToPropagate: [
    'x-custom-1', 'x-custom-2',
  ],
});

// Simple Express app that makes a call to a outbound service
// to prove that we propagate headers (using the request module)
app.get('/', (req, res) => {
  const options = url.parse('http://localhost:8888/');
  const request = http.request(options, response => {
    if (response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  });

  request.on('error', () => {
    res.status(500).send('boom');
  });

  request.end();
});

// Simple HTTP service created with the original (not instrumented)
// http server. We'll use it to assert that the headers are properly propagated
// We can't use nock here or any other modules that intercept http calls as they
// usually bypass the instrumentation (never actually makes the http call)
async function withOutboundService(fn) {
  const outboundService = await http.createServer__original((req, res) => {
    res.writeHead(200);
    res.end('ok');
  }).listen(8888);

  try {
    await fn(outboundService);
  } finally {
    outboundService.close();
  }
}

test('should propagate headers when parsing urls without headers', assert => {
  assert.plan(3);

  const correlationId = 'my-correlation-id';

  withOutboundService(async service => {
    service.on('request', req => {
      assert.equal(req.headers['x-correlation-id'], correlationId);
    });

    const response = await supertest(app)
      .get('/')
      .set('x-correlation-id', correlationId);

    assert.equal(response.statusCode, 200);
    assert.equal(correlationId, response.headers['x-correlation-id']);
  });
});
