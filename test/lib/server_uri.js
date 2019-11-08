module.exports = (isHttps, server) => {
  const address = server.address();
  const protocol = isHttps ? 'https' : 'http';
  return `${protocol}://localhost:${address.port}/`;
};
