const test = require('tape');
const { promisify } = require('util');
const downstreamServer = promisify(require('./lib/mock_downstream_server'));
const testSubjectServer = promisify(require('./lib/test_subject_server'));
const callWithRequest = require('./lib/call-with-request');
const callWithRequestPromise = require('./lib/call-with-request-promise');
const callWithRequestPromiseNative = require('./lib/call-with-request-promise-native');
const hpropagate = require('../index');

hpropagate();

const clientBuilders = [callWithRequest, callWithRequestPromise, callWithRequestPromiseNative];
const protocols = [true, false];

const union = (source, spec) => {
  const copy = {};
  Object.keys(spec).forEach(key => {
    if (source[key]) { copy[key] = source[key]; }
  });
  return copy;
};

function doTest(frontEndIsHttps, backEndIsHttps, clientBuilder) {
  return async assert => {
    let dsServer;
    let tsServer;
    try {
      dsServer = await downstreamServer({ isHttps: backEndIsHttps });
      const callerInServer = promisify(clientBuilder.fn(backEndIsHttps, dsServer));
      tsServer = await testSubjectServer({ isHttps: frontEndIsHttps, client: callerInServer });
      const callerInClient = promisify(clientBuilder.fn(frontEndIsHttps, tsServer));
      const headersToPropogate = {
        'x-correlation-id': 'test',
      };
      const headersNotToPropagate = {
        'x-something-else': 'something',
      };
      const body = await callerInClient({ ...headersToPropogate, ...headersNotToPropagate });
      assert.deepEqual(union(body, headersToPropogate), headersToPropogate, 'Server received headers that should be propagated');
      assert.deepEqual(union(body, headersNotToPropagate), {}, 'Server did not receive headers that should not be propagated');
    } catch (e) {
      assert.fail('Exception', e);
    } finally {
      await Promise.all([dsServer.close(), tsServer.close()]);
      assert.end();
    }
  };
}

test('Request through hpropagate', async t => {
  protocols.forEach(frontEndIsHttps => {
    protocols.forEach(backEndIsHttps => {
      clientBuilders.forEach(clientBuilder => {
        t.test(
          `Front end: ${frontEndIsHttps ? 'https' : 'http'}, Back end: ${backEndIsHttps ? 'https' : 'http'}, Client: ${clientBuilder.name}`,
          doTest(frontEndIsHttps, backEndIsHttps, clientBuilder)
        );
      });
    });
  });
});
