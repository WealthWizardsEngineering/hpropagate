const https = require('https');
const http = require('https');
const fs = require('fs');

const requestListener = (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.write(JSON.stringify(req.headers));
  res.end();
};

const httpOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

module.exports = async ({ isHttps }, callback) => {
  const serverModule = isHttps ? https : http;
  const srv = serverModule.createServer({ ...httpOptions }, requestListener);
  srv.listen({ port: 0 }, callback);
};
