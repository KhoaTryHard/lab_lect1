import { spawn } from 'node:child_process';

const env = { ...process.env, ALLOW_TEST_RESET: '1' };
const server = spawn(process.execPath, ['src/server.mjs'], { stdio: 'inherit', env });
const proxy = spawn(process.execPath, ['src/proxy.mjs'], { stdio: 'inherit', env });
const stop = () => { server.kill(); proxy.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('exit', (code) => { if (code !== 0) proxy.kill(); });
console.log('Demo: mở http://127.0.0.1:3000 và nhấn Ctrl+C để dừng.');
