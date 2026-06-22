// Prueba local del entrypoint serverless (simula el runtime de Vercel).
const http = require('http');
const handler = require('../api/index.js');
const PORT = 3005;
http.createServer((req, res) => handler(req, res)).listen(PORT, () => {
  console.log(`serverless handler local en http://localhost:${PORT}`);
});
