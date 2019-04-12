// Needed to instrument the http module
const test = require('tape');
const http = require('http');
const supertest = require('supertest');
const express = require('express');
const request = require('request');
const sinon = require('sinon');
const hpropagate = require('../index');

const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

const app = express();
hpropagate({
  headersToPropagate: [
    'x-custom-1', 'x-custom-2',
  ],
});

// Simple Express app that makes a call to a outbound service
// to prove that we propagate headers (using the request module)
app.get('/', (req, res) => {
  request('http://localhost:8888/', (error, response) => {
    if (error || response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  });
});

app.get('/parallel', (req, res) => {
  setTimeout(() => request('http://localhost:8888/', (error, response) => {
    if (error || response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  }), req.query.duration);
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

test('should propagate correlation id if received on request', assert => {
  assert.plan(3);

  const correlationId = 'my-correlation-id';

  withOutboundService(async service => {
    // we can intercept the outbound request to assert that the headers
    // are properly propagated
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

test('should set and propagate correlation id if not received on request', assert => {
  assert.plan(3);

  withOutboundService(async service => {
    let outboundCorrelationId;
    service.on('request', req => {
      outboundCorrelationId = req.headers['x-correlation-id'];
    });

    const response = await supertest(app).get('/');

    assert.equal(response.statusCode, 200);
    assert.ok(uuidRegex.test(response.headers['x-correlation-id']));
    assert.equal(outboundCorrelationId, response.headers['x-correlation-id']);
  });
});

test('should propagate headers from list', assert => {
  assert.plan(3);

  withOutboundService(async service => {
    service.on('request', req => {
      assert.equal(req.headers['x-custom-1'], 'random1');
      assert.equal(req.headers['x-custom-2'], 'random2');
    });

    const response = await supertest(app)
      .get('/')
      .set('x-custom-1', 'random1')
      .set('x-custom-2', 'random2');

    assert.equal(response.statusCode, 200);
  });
});

test('should not propagate correlation id when asked not to', assert => {
  assert.plan(3);

  hpropagate({
    setAndPropagateCorrelationId: false,
  });

  withOutboundService(async service => {
    service.on('request', req => {
      assert.ok(typeof req.headers['x-correlation-id'] === 'undefined');
    });

    const response = await supertest(app).get('/');

    assert.equal(response.statusCode, 200);
    assert.ok(typeof response.headers['x-correlation-id'] === 'undefined');
  });
});

test('should propagate headers in responses when asked to', assert => {
  assert.plan(5);

  hpropagate({
    propagateInResponses: true,
    headersToPropagate: [
      'x-custom-1', 'x-custom-2',
    ],
  });

  withOutboundService(async service => {
    service.on('request', req => {
      assert.equal(req.headers['x-custom-1'], 'random1');
      assert.equal(req.headers['x-custom-2'], 'random2');
    });

    const response = await supertest(app)
      .get('/')
      .set('x-custom-1', 'random1')
      .set('x-custom-2', 'random2');

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['x-custom-1'], 'random1');
    assert.equal(response.headers['x-custom-2'], 'random2');
  });
});

test('should not propagate headers in responses when not asked to', assert => {
  assert.plan(5);

  hpropagate({
    propagateInResponses: false,
    headersToPropagate: [
      'x-custom-1', 'x-custom-2',
    ],
  });

  withOutboundService(async service => {
    service.on('request', req => {
      assert.equal(req.headers['x-custom-1'], 'random1');
      assert.equal(req.headers['x-custom-2'], 'random2');
    });

    const response = await supertest(app)
      .get('/')
      .set('x-custom-1', 'random1')
      .set('x-custom-2', 'random2');

    assert.equal(response.statusCode, 200);
    assert.ok(typeof response.headers['x-custom-1'] === 'undefined');
    assert.ok(typeof response.headers['x-custom-2'] === 'undefined');
  });
});

test('should use correct headers for all calls', assert => {
  assert.plan(5);

  hpropagate({
    propagateInResponses: false,
    headersToPropagate: [
      'x-custom-1', 'x-custom-2',
    ],
  });

  withOutboundService(async service => {
    const stubRequestFn = sinon.stub();
    service.on('request', req => {
      stubRequestFn(req.headers['x-custom-1']);
      stubRequestFn(req.headers['x-custom-2']);
    });

    await Promise.all([
      supertest(app)
        .get('/parallel')
        .query({ duration: 1000 })
        .set('x-custom-1', 'random1')
        .set('x-custom-2', 'random2'),
      supertest(app)
        .get('/parallel')
        .query({ duration: 200 })
        .set('x-custom-1', 'random3')
        .set('x-custom-2', 'random4'),
    ]);

    assert.equal(stubRequestFn.callCount, 4);
    assert.equal(stubRequestFn.args[0][0], 'random3');
    assert.equal(stubRequestFn.args[1][0], 'random4');
    assert.equal(stubRequestFn.args[2][0], 'random1');
    assert.equal(stubRequestFn.args[3][0], 'random2');
  });
});
