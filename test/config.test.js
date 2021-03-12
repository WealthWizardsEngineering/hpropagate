const test = require('tape');
const configLoader = require('../lib/config');

const defaultHeadersToCollect = [
  'x-request-id',
  'x-b3-traceid',
  'x-b3-spanid',
  'x-b3-parentspanid',
  'x-b3-sampled',
  'x-b3-flags',
  'x-ot-span-context',
  'x-variant-id',
  'x-feature-flags',
];

const defaultHeadersToInject = [
  'x-correlation-id',
  'x-request-id',
  'x-b3-traceid',
  'x-b3-spanid',
  'x-b3-parentspanid',
  'x-b3-sampled',
  'x-b3-flags',
  'x-ot-span-context',
  'x-variant-id',
  'x-feature-flags',
];

test('should provide correlation id header name', assert => {
  assert.plan(1);

  const config = configLoader.load();

  assert.equal(config.correlationIdHeader, 'x-correlation-id');
});

test('should load default config', assert => {
  assert.plan(2);

  const defaultConfig = configLoader.load();

  assert.deepEqual(defaultConfig.headersToCollect, defaultHeadersToCollect);
  assert.deepEqual(defaultConfig.headersToInject, defaultHeadersToInject);
});

test('should be able to disable propagating correlation id', assert => {
  assert.plan(2);

  const config = configLoader.load({
    setAndPropagateCorrelationId: false,
  });

  assert.deepEqual(config.headersToCollect, defaultHeadersToCollect);
  assert.deepEqual(config.headersToInject, defaultHeadersToCollect);
});

test('should be able to override headers list', assert => {
  assert.plan(2);

  const config = configLoader.load({
    setAndPropagateCorrelationId: false,
    headersToPropagate: [
      'x-custom-header-1',
      'x-custom-header-2',
    ],
  });

  assert.deepEqual(config.headersToCollect, [
    'x-custom-header-1',
    'x-custom-header-2',
  ]);
  assert.deepEqual(config.headersToInject, [
    'x-custom-header-1',
    'x-custom-header-2',
  ]);
});

test('should automatically propagate correlation id', assert => {
  assert.plan(1);

  const config = configLoader.load({
    headersToPropagate: ['das-header'],
  });

  assert.deepEqual(config.headersToInject, [
    'x-correlation-id',
    'das-header',
  ]);
});

test('should validate headers is a valid list of HTTP headers', assert => {
  assert.plan(2);

  assert.throws(() => {
    configLoader.load({
      headersToPropagate: 'das-header',
    });
  }, new Error('Header list is not an array'));

  assert.throws(() => {
    configLoader.load({
      headersToPropagate: ['une-entete', 1, 'cannot have space'],
    });
  }, new Error('Header list contains invalid headers: 1,cannot have space'));
});
