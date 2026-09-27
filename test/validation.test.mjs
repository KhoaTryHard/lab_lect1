import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from '../shared/validation.mjs';
import { createApp } from '../src/server.mjs';
import http from 'node:http';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
function request(server, body) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/register', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
      let raw = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}

const valid = { fullName: 'Nguyễn Văn A', email: 'a@example.test', password: 'password1', confirmPassword: 'password1' };

test('shared validation rejects malformed values and accepts valid values', () => {
  assert.equal(validateRegistration(valid).valid, true);
  const checked = validateRegistration({ ...valid, email: 'broken' });
  assert.equal(checked.valid, false);
  assert.match(checked.errors.email, /định dạng/);
});

test('server validates independently and handles duplicate email', async (t) => {
  const server = await listen(createApp({ allowTestReset: true }));
  t.after(() => server.close());
  const invalid = await request(server, { ...valid, email: 'broken' });
  assert.equal(invalid.status, 422);
  const first = await request(server, valid);
  assert.equal(first.status, 201);
  const duplicate = await request(server, valid);
  assert.equal(duplicate.status, 409);
});
