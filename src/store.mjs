/* Quan ly kho dang ky trong bo nho va xu ly du lieu mau. */
export function createRegistrationStore() {
  const registrations = new Map();
  const seed = () => {
    registrations.clear();
    registrations.set('taken@example.test', {
      id: 'seed-taken',
      fullName: 'Tài khoản mẫu',
      email: 'taken@example.test'
    });
  };
  seed();

  return {
    reset: seed,
    has(email) { return registrations.has(email); },
    add(record) { registrations.set(record.email, record); },
    size() { return registrations.size; }
  };
}
