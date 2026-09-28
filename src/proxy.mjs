/* Chuyen tiep request den server va mo phong do tre round-trip. */
import http from 'node:http';

const listenPort = Number(process.env.PROXY_PORT || 3000);
const targetPort = Number(process.env.SERVER_PORT || 3001);
const delayMs = Number(process.env.RTT_MS || 0);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function forward(req, res) {
  const requestDelay = Number(req.headers['x-lab-rtt'] ?? delayMs);
  const delayed = req.method === 'POST' && req.url === '/api/register';
  const collect = delayed;
  const chunks = [];
  req.on('data', (chunk) => { if (collect) chunks.push(chunk); });
  req.on('end', async () => {
    if (delayed) await wait(Math.max(0, requestDelay / 2));
    const body = collect ? Buffer.concat(chunks) : undefined;
    const headers = { ...req.headers, host: `127.0.0.1:${targetPort}` };
    if (body) headers['content-length'] = body.length;
    const upstream = http.request({
      hostname: '127.0.0.1', port: targetPort, path: req.url, method: req.method, headers
    }, (upstreamRes) => {
      const responseChunks = [];
      upstreamRes.on('data', (chunk) => responseChunks.push(chunk));
      upstreamRes.on('end', async () => {
        if (delayed) await wait(Math.max(0, requestDelay / 2));
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        res.end(Buffer.concat(responseChunks));
      });
    });
    upstream.on('error', (error) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: error.message }));
    });
    if (body) upstream.write(body);
    upstream.end();
  });
}

const server = http.createServer(forward);
server.listen(listenPort, '127.0.0.1', () => {
  console.log(`proxy listening on http://127.0.0.1:${listenPort} -> ${targetPort} (RTT ${delayMs}ms)`);
});
