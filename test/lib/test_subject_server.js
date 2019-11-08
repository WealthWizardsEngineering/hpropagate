const https = require('https');
const http = require('http');
const certs = require('./certs');

const requestListener = client => (req, res) => {
  client({}, (error, body) => {
    if (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify(error));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
};

const httpsOptions = {
  ...certs,
};

module.exports = ({ isHttps, client }, callback) => {
  const server = isHttps
    ? https.createServer({ ...httpsOptions }, requestListener(client))
    : http.createServer(requestListener(client));
  server.listen({ port: 0 }, () => callback(null, server));
};
