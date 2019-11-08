const https = require('https');
const http = require('http');
const certs = require('./certs');

const requestListener = (req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(req.headers));
};

const httpOptions = {
  ...certs,
};

module.exports = ({ isHttps }, callback) => {
  const server = isHttps
    ? https.createServer({ ...httpOptions }, requestListener)
    : http.createServer(requestListener);
  server.listen({ port: 0 }, () => callback(null, server));
};
