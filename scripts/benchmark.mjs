import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = process.cwd();
const outputDir = process.env.BENCH_OUTPUT_DIR ? path.resolve(process.env.BENCH_OUTPUT_DIR) : path.join(root, 'reports');
const iterations = Number(process.env.BENCH_ITERATIONS || 30);
const serverPort = 3101;
const proxyPort = 3100;
const env = { ...process.env, SERVER_PORT: String(serverPort), PROXY_PORT: String(proxyPort), ALLOW_TEST_RESET: '1' };
const children = [];
const start = (file, extra = {}) => { const child = spawn(process.execPath, [file], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child); return child; };
const stop = () => children.forEach((child) => {
  if (!child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
});
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(130); });

async function waitFor(url) { for (let i = 0; i < 80; i += 1) { try { const r = await fetch(url); if (r.ok) return; } catch {} await delay(100); } throw new Error(`Timed out waiting for ${url}`); }
function csvEscape(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function percentile(values, p) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]; }

start('src/server.mjs');
start('src/proxy.mjs', { RTT_MS: '0' });
await waitFor(`http://127.0.0.1:${proxyPort}/api/health`);
const browser = await chromium.launch();
const rows = [];
const scenarios = {
  invalid_format: { fullName: 'Nguyễn Văn A', email: 'broken', password: 'password1', confirmPassword: 'password1' },
  valid: { fullName: 'Nguyễn Văn A', email: 'bench-valid@example.test', password: 'password1', confirmPassword: 'password1' },
  duplicate: { fullName: 'Nguyễn Văn A', email: 'taken@example.test', password: 'password1', confirmPassword: 'password1' }
};
try {
  const page = await browser.newPage();
  for (const rtt of [0, 200, 500, 1000]) {
    for (const [scenario, data] of Object.entries(scenarios)) {
      for (const mode of ['server', 'client']) {
        for (let iteration = 1; iteration <= iterations; iteration += 1) {
          await fetch(`http://127.0.0.1:${serverPort}/api/test/reset`, { method: 'POST' });
          await page.goto(`http://127.0.0.1:${proxyPort}/?rtt=${rtt}`);
          await page.locator(`input[value="${mode}"]`).check();
          for (const [field, value] of Object.entries(data)) await page.locator(`[data-field="${field}"]`).fill(value);
          const requests = []; const responseBytes = []; const responsePromises = [];
          const onRequest = (request) => { if (request.url().endsWith('/api/register')) requests.push(request); };
          const onResponse = (response) => {
            if (response.url().endsWith('/api/register')) {
              responsePromises.push(response.body().then((body) => responseBytes.push(body.byteLength)).catch(() => {}));
            }
          };
          page.on('request', onRequest);
          page.on('response', onResponse);
          const started = performance.now();
          await page.locator('#submit-button').click();
          await page.locator('#result').waitFor({ state: 'visible' });
          await page.waitForFunction(() => Boolean(document.querySelector('#result')?.dataset.outcome));
          const feedbackMs = Number(await page.locator('#result').getAttribute('data-feedback-ms'));
          const outcome = await page.locator('#result').getAttribute('data-outcome');
          await Promise.all(responsePromises);
          page.off('request', onRequest);
          page.off('response', onResponse);
          rows.push({
            rtt, scenario, mode, iteration,
            feedback_ms: Number.isFinite(feedbackMs) ? feedbackMs : performance.now() - started,
            http_request_count: requests.length,
            request_body_bytes: requests.reduce((sum, request) => sum + Buffer.byteLength(request.postData() || '', 'utf8'), 0),
            response_body_bytes: responseBytes.reduce((sum, bytes) => sum + bytes, 0),
            outcome
          });
        }
      }
    }
  }
} finally { await browser.close(); }

await fs.mkdir(outputDir, { recursive: true });
const headers = ['rtt', 'scenario', 'mode', 'iteration', 'feedback_ms', 'http_request_count', 'request_body_bytes', 'response_body_bytes', 'outcome'];
await fs.writeFile(path.join(outputDir, 'benchmark.csv'), `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')).join('\n')}\n`);
const summary = [];
for (const rtt of [0, 200, 500, 1000]) for (const scenario of Object.keys(scenarios)) for (const mode of ['server', 'client']) {
  const selected = rows.filter((row) => row.rtt === rtt && row.scenario === scenario && row.mode === mode);
  summary.push({ rtt, scenario, mode, n: selected.length, median_feedback_ms: percentile(selected.map((row) => row.feedback_ms), 50), p95_feedback_ms: percentile(selected.map((row) => row.feedback_ms), 95), requests: selected.reduce((sum, row) => sum + row.http_request_count, 0), request_body_bytes: selected.reduce((sum, row) => sum + row.request_body_bytes, 0), response_body_bytes: selected.reduce((sum, row) => sum + row.response_body_bytes, 0), outcomes: [...new Set(selected.map((row) => row.outcome))].join('|') });
}
await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
const invalidServer = summary.filter((row) => row.scenario === 'invalid_format' && row.mode === 'server');
const invalidClient = summary.filter((row) => row.scenario === 'invalid_format' && row.mode === 'client');
const analysis = [
  '# Phân tích benchmark',
  '',
  `Ma trận gồm ${rows.length} lượt đo: ${iterations} lượt cho mỗi RTT, tình huống và chế độ. RTT được proxy chia đều trước request và trước response.`,
  '',
  '| RTT | Server validation median (ms) | Local validation median (ms) | Request server/local |',
  '|---:|---:|---:|---:|',
  ...invalidServer.map((row) => {
    const local = invalidClient.find((candidate) => candidate.rtt === row.rtt);
    return `| ${row.rtt} | ${row.median_feedback_ms.toFixed(1)} | ${local.median_feedback_ms.toFixed(1)} | ${row.requests} / ${local.requests} |`;
  }),
  '',
  'Với lỗi định dạng, local validation phản hồi trong khoảng thời gian xử lý JavaScript và không gửi request. Server validation phải trả một round-trip nên thời gian tăng gần theo RTT. Với dữ liệu hợp lệ hoặc email đã tồn tại, cả hai chế độ vẫn cần server; local validation chỉ loại bỏ lỗi định dạng phía client.',
  '',
  '## Liên hệ 8 giả định sai',
  '',
  '- **Latency is zero:** được kiểm chứng trực tiếp bằng chênh lệch khi RTT tăng.',
  '- **Bandwidth is infinite / Transport cost is zero:** local validation tránh gửi request và body cho lỗi định dạng.',
  '- **The network is reliable:** UI có nhánh lỗi kết nối; local validation không biến mất khi server không thể truy cập.',
  '- **The network is secure, homogeneous, topology does not change, one administrator:** không được giải quyết bởi validation; cần cơ chế bảo mật, giao thức, discovery và quản trị riêng.',
  '',
  'Kết quả là mô phỏng trên một máy; không đại diện cho packet loss, jitter, TLS handshake, WAN bandwidth hoặc chi phí tải JavaScript ban đầu.'
].join('\n');
await fs.writeFile(path.join(outputDir, 'analysis.md'), `${analysis}\n`);
const reportData = JSON.stringify(summary).replaceAll('<', '\\u003c');
const report = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Latency Hiding Benchmark</title><style>body{font:15px system-ui;background:#091423;color:#eaf4ff;margin:32px}main{max-width:1200px;margin:auto}h1{color:#63d9ed}p{color:#a9bad0}.chart{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.card{border:1px solid #2a4668;border-radius:12px;padding:14px;background:#10223a}.bar{height:12px;background:#63d9ed;border-radius:5px;margin:5px 0 12px}.bar.client{background:#a3edbb}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px}th,td{border-bottom:1px solid #263d58;padding:7px;text-align:left}th{color:#ffd38a}</style></head><body><main><h1>Latency Hiding · Benchmark</h1><p>Median feedback theo round-trip mô phỏng. Local validation giữ lỗi định dạng ở trình duyệt; server validation phải chờ response.</p><section class="chart" id="chart"></section><table><thead><tr><th>RTT</th><th>Tình huống</th><th>Mode</th><th>n</th><th>Median ms</th><th>P95 ms</th><th>Requests</th><th>Request bytes</th><th>Response bytes</th><th>Outcome</th></tr></thead><tbody id="rows"></tbody></table></main><script>const summary=${reportData};const fmt=n=>Number(n).toFixed(1);const rows=document.querySelector('#rows');for(const r of summary){const tr=document.createElement('tr');tr.innerHTML='<td>'+r.rtt+' ms</td><td>'+r.scenario+'</td><td>'+r.mode+'</td><td>'+r.n+'</td><td>'+fmt(r.median_feedback_ms)+'</td><td>'+fmt(r.p95_feedback_ms)+'</td><td>'+r.requests+'</td><td>'+r.request_body_bytes+'</td><td>'+r.response_body_bytes+'</td><td>'+r.outcomes+'</td>';rows.append(tr)}const chart=document.querySelector('#chart');for(const scenario of ['invalid_format','valid','duplicate']){const card=document.createElement('article');card.className='card';card.innerHTML='<strong>'+scenario+'</strong>';for(const rtt of [0,200,500,1000]){const pair=summary.filter(r=>r.scenario===scenario&&r.rtt===rtt);const max=Math.max(...pair.map(r=>r.median_feedback_ms),1);const label=document.createElement('div');label.innerHTML='<small>'+rtt+' ms</small>';for(const r of pair){const line=document.createElement('div');line.innerHTML='<small>'+r.mode+': '+fmt(r.median_feedback_ms)+' ms ('+r.requests+' req)</small><div class="bar '+r.mode+'" style="width:'+Math.max(2,Math.min(100,r.median_feedback_ms/max*100))+'%"></div>';label.append(line)}card.append(label)}chart.append(card)}</script></body></html>`;
await fs.writeFile(path.join(outputDir, 'report.html'), report);
console.log(`Wrote ${rows.length} benchmark rows to ${outputDir}`);
stop();
process.exit(0);
