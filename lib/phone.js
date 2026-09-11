// ============================================
// JAVA EVENTS - MEXICO PHONE UTILITIES
// ============================================

export function normalizeMexicoPhone(value) {
  if (!value) {
    return null;
  }

  let digits = String(value).replace(/\D/g, "");

  // 0052 8711234567
  if (
    digits.startsWith("0052") &&
    digits.length === 14
  ) {
    digits = digits.slice(4);
  }

  // Formato antiguo mexicano:
  // +52 1 8711234567
  if (
    digits.startsWith("521") &&
    digits.length === 13
  ) {
    digits = digits.slice(3);
  }

  // +52 8711234567
  if (
    digits.startsWith("52") &&
    digits.length === 12
  ) {
    digits = digits.slice(2);
  }

  // México requiere 10 dígitos nacionales.
  if (!/^\d{10}$/.test(digits)) {
    return null;
  }

  return `+52${digits}`;
}

export function isValidMexicoPhone(value) {
  return Boolean(
    normalizeMexicoPhone(value)
  );
}

export function formatMexicoPhoneInput(value) {
  if (!value) {
    return "";
  }

  let digits = String(value).replace(/\D/g, "");

  if (
    digits.startsWith("521") &&
    digits.length > 10
  ) {
    digits = digits.slice(3);
  } else if (
    digits.startsWith("52") &&
    digits.length > 10
  ) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)} ${digits.slice(
    3,
    6
  )} ${digits.slice(6)}`;
}