/* Dieu khien form dang ky, validation tai client va hien thi ket qua request. */
import { validateRegistration } from '/shared/validation.mjs';

const form = document.querySelector('#registration-form');
const result = document.querySelector('#result');
const button = document.querySelector('#submit-button');
const fields = ['fullName', 'email', 'password', 'confirmPassword'];
const params = new URLSearchParams(location.search);
const rtt = Number(params.get('rtt') || 0);
document.querySelector('#rtt-label').textContent = `${Number.isFinite(rtt) ? rtt : 0} ms`;

window.__lab = { last: null, requestCount: 0 };

function currentMode() { return document.querySelector('input[name="mode"]:checked').value; }
function readForm() { return Object.fromEntries(new FormData(form).entries()); }
function clearErrors() {
  for (const field of fields) {
    document.querySelector(`[data-error-for="${field}"]`).textContent = '';
    document.querySelector(`[data-field="${field}"]`).removeAttribute('aria-invalid');
  }
}
function showErrors(errors = {}) {
  for (const [field, message] of Object.entries(errors)) {
    const input = document.querySelector(`[data-field="${field}"]`);
    const slot = document.querySelector(`[data-error-for="${field}"]`);
    if (input && slot) { input.setAttribute('aria-invalid', 'true'); slot.textContent = message; }
  }
}
function finish(outcome, startedAt, extra = {}) {
  const feedbackMs = performance.now() - startedAt;
  window.__lab.last = { outcome, feedbackMs, ...extra };
  result.dataset.outcome = outcome;
  result.dataset.feedbackMs = String(feedbackMs);
  result.className = `result ${outcome === 'success' ? 'success' : 'failure'}`;
  window.dispatchEvent(new CustomEvent('lab-result', { detail: window.__lab.last }));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  result.textContent = 'Đang xử lý…';
  result.className = 'result';
  button.disabled = true;
  const startedAt = performance.now();
  const payload = readForm();
  const mode = currentMode();

  if (mode === 'client') {
    const checked = validateRegistration(payload);
    if (!checked.valid) {
      showErrors(checked.errors);
      result.textContent = 'Dữ liệu chưa được gửi: lỗi định dạng đã được phát hiện tại client.';
      finish('client-validation-error', startedAt, { mode, requestCount: 0 });
      button.disabled = false;
      return;
    }
  }

  window.__lab.requestCount += 1;
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lab-rtt': String(Number.isFinite(rtt) ? rtt : 0) },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      showErrors(body.errors);
      result.textContent = body.code === 'EMAIL_EXISTS' ? 'Email này đã tồn tại trên server.' : 'Server từ chối dữ liệu đăng ký.';
      finish('server-error', startedAt, { mode, status: response.status, requestCount: 1 });
    } else {
      result.textContent = 'Đăng ký thành công.';
      finish('success', startedAt, { mode, status: response.status, requestCount: 1 });
    }
  } catch (error) {
    result.textContent = 'Không thể kết nối tới server. Vui lòng thử lại.';
    finish('network-error', startedAt, { mode, message: error.message, requestCount: 1 });
  } finally { button.disabled = false; }
});
