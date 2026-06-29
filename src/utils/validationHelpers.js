const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PERSON_NAME_PATTERN = /^[A-Za-z\u00c0-\u017F\u00d1\u00f1\s.'-]+$/;

const cleanText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const cleanOptionalText = (value) => {
  const cleaned = cleanText(value);
  return cleaned || null;
};

const onlyDigits = (value) => cleanText(value).replace(/\D/g, '');

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const isValidEmail = (value) => EMAIL_PATTERN.test(cleanText(value).toLowerCase());

const isValidPersonName = (value, { min = 2, max = 80 } = {}) => {
  const text = cleanText(value);
  return text.length >= min && text.length <= max && PERSON_NAME_PATTERN.test(text);
};

const isStrongPassword = (value) => {
  const password = String(value || '');

  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
};

const hasRepeatedDigits = (value) => {
  const digits = onlyDigits(value);
  return digits.length >= 6 && /^(\d)\1+$/.test(digits);
};

const isValidPhone = (value, { min = 7, max = 15, required = false } = {}) => {
  const digits = onlyDigits(value);

  if (!digits) return !required;

  return digits.length >= min && digits.length <= max && !hasRepeatedDigits(digits);
};

const isValidUrl = (value, { required = false } = {}) => {
  const text = cleanText(value);

  if (!text) return !required;

  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (error) {
    return false;
  }
};

const validateTextLength = (value, max, label, errores, { required = false, min = 0 } = {}) => {
  const text = cleanText(value);

  if (required && !text) {
    errores.push(`${label} es obligatorio.`);
    return;
  }

  if (text && text.length < min) {
    errores.push(`${label} debe tener como m\u00ednimo ${min} caracteres.`);
  }

  if (text.length > max) {
    errores.push(`${label} no debe superar los ${max} caracteres.`);
  }
};

module.exports = {
  cleanOptionalText,
  cleanText,
  hasRepeatedDigits,
  isPositiveInteger,
  isStrongPassword,
  isValidEmail,
  isValidPersonName,
  isValidPhone,
  isValidUrl,
  onlyDigits,
  validateTextLength
};
