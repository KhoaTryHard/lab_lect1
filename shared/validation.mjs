/* Kiem tra va chuan hoa du lieu dang ky dung chung cho client va server. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration(input = {}) {
  const value = {
    fullName: typeof input.fullName === 'string' ? input.fullName.trim() : '',
    email: typeof input.email === 'string' ? input.email.trim().toLowerCase() : '',
    password: typeof input.password === 'string' ? input.password : '',
    confirmPassword: typeof input.confirmPassword === 'string' ? input.confirmPassword : ''
  };
  const errors = {};

  if (!value.fullName) errors.fullName = 'Họ tên là bắt buộc.';
  else if (value.fullName.length < 2 || value.fullName.length > 80) {
    errors.fullName = 'Họ tên phải dài từ 2 đến 80 ký tự.';
  }

  if (!value.email) errors.email = 'Email là bắt buộc.';
  else if (value.email.length > 254 || !EMAIL_PATTERN.test(value.email)) {
    errors.email = 'Email không đúng định dạng.';
  }

  if (!value.password) errors.password = 'Mật khẩu là bắt buộc.';
  else if (value.password.length < 8 || value.password.length > 64) {
    errors.password = 'Mật khẩu phải dài từ 8 đến 64 ký tự.';
  }

  if (!value.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
  else if (value.confirmPassword !== value.password) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  }

  return { value, errors, valid: Object.keys(errors).length === 0 };
}
