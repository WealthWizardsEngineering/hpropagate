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

app.get('/request/url-first', (req, res) => {
  const request = http.request('http://localhost:8888/', {}, response => {
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

app.get('/request/url-first/no-options', (req, res) => {
  const request = http.request('http://localhost:8888/', response => {
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

app.get('/get/options-first', (req, res) => {
  const options = url.parse('http://localhost:8888/');
  const request = http.get(options, response => {
    if (response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  });

  request.on('error', () => {
    res.status(500).send('boom');
  });
});

app.get('/get/url-first', (req, res) => {
  const request = http.get('http://localhost:8888/', {}, response => {
    if (response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  });

  request.on('error', () => {
    res.status(500).send('boom');
  });
});

app.get('/get/url-first/no-options', (req, res) => {
  const request = http.get('http://localhost:8888/', response => {
    if (response.statusCode !== 200) {
      res.status(500).send('boom');
      return;
    }
    res.status(200).send('successful');
  });

  request.on('error', () => {
    res.status(500).send('boom');
  });
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

test('should propagate headers similarly for all http.request and http.get method signatures', assert => {
  const urlPaths = [
    '/',
    '/request/url-first',
    '/request/url-first/no-options',
    '/get/options-first',
    '/get/url-first',
    '/get/url-first/no-options',
  ];

  assert.plan(5 * urlPaths.length);

  const correlationId = 'a-correlation-id';
  const custom2 = 'value-2';
  const custom3 = 'value-3';

  withOutboundService(async service => {
    service.on('request', req => {
      assert.equal(req.headers['x-custom-2'], custom2);
      assert.equal(typeof req.headers['x-custom-3'], 'undefined');
      assert.equal(req.headers['x-correlation-id'], correlationId);
    });

    for (let i = 0; i < urlPaths.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await supertest(app)
        .get(urlPaths[i])
        .set('x-custom-2', custom2)
        .set('x-custom-3', custom3)
        .set('x-correlation-id', correlationId);

      assert.equal(response.statusCode, 200);
      assert.equal(correlationId, response.headers['x-correlation-id']);
    }
  });
});
