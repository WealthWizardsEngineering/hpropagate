const request = require('request');
const certs = require('./certs');
const serverUri = require('./server_uri');

const options = {
  json: true,
  agentOptions: {
    ca: certs.cert,
  },
};

module.exports = {
  name: 'request-promise',
  fn: (isHttps, downstreamServer) => (headers, callback) => {
    const uri = serverUri(isHttps, downstreamServer);
    request({
      ...options,
      uri,
      headers,
    }, (err, response, body) => callback(err, body));
  },
};
