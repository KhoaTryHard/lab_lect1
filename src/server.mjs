/* Xu ly API dang ky, phuc vu tai file frontend va kiem tra du lieu o server. */
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRegistration } from '../shared/validation.mjs';
import { createRegistrationStore } from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export function createApp({ store = createRegistrationStore(), allowTestReset = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, registrations: store.size() }));

  app.post('/api/register', (req, res) => {
    const checked = validateRegistration(req.body);
    if (!checked.valid) {
      return res.status(422).json({ ok: false, code: 'VALIDATION_ERROR', errors: checked.errors });
    }
    if (store.has(checked.value.email)) {
      return res.status(409).json({
        ok: false,
        code: 'EMAIL_EXISTS',
        errors: { email: 'Email này đã được đăng ký.' }
      });
    }

    const record = {
      id: crypto.randomUUID(),
      fullName: checked.value.fullName,
      email: checked.value.email
    };
    store.add(record);
    return res.status(201).json({ ok: true, registrationId: record.id, message: 'Đăng ký thành công.' });
  });

  if (allowTestReset) {
    app.post('/api/test/reset', (_req, res) => {
      store.reset();
      res.json({ ok: true });
    });
  }

  app.use('/shared', express.static(path.join(rootDir, 'shared'), { fallthrough: false }));
  app.use(express.static(path.join(rootDir, 'public')));
  app.use((_req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
  return app;
}

export function startServer({ port = Number(process.env.SERVER_PORT || 3001), allowTestReset = process.env.ALLOW_TEST_RESET === '1' } = {}) {
  const app = createApp({ allowTestReset });
  return app.listen(port, '127.0.0.1', () => {
    console.log(`server listening on http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  startServer();
}
