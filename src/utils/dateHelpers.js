const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value) => String(value).padStart(2, '0');

const toDateOnly = (date = new Date()) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const isValidDateOnly = (value) => Boolean(parseDateOnly(value));

const addDays = (dateOnly, days) => {
  const date = parseDateOnly(dateOnly);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

const diffDays = (startDateOnly, endDateOnly) => {
  const start = parseDateOnly(startDateOnly);
  const end = parseDateOnly(endDateOnly);

  if (!start || !end) return null;

  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

const isDateNotAbsurd = (dateOnly, { minYear = 2000, maxFutureYears = 5 } = {}) => {
  const date = parseDateOnly(dateOnly);

  if (!date) return false;

  const year = date.getUTCFullYear();
  const maxYear = new Date().getFullYear() + maxFutureYears;

  return year >= minYear && year <= maxYear;
};

const isPastDateOnly = (dateOnly, today = toDateOnly()) => {
  return isValidDateOnly(dateOnly) && dateOnly < today;
};

const isFutureDateOnly = (dateOnly, today = toDateOnly()) => {
  return isValidDateOnly(dateOnly) && dateOnly > today;
};

const validateDateRange = ({
  start,
  end,
  allowSameDay = false,
  allowPast = false,
  minYear = 2000,
  maxFutureYears = 5,
  maxDays = null,
  fieldStart = 'La fecha de inicio',
  fieldEnd = 'La fecha de fin'
}) => {
  const errores = [];

  if (!isValidDateOnly(start) || !isValidDateOnly(end)) {
    errores.push('Las fechas deben tener formato YYYY-MM-DD');
    return errores;
  }

  if (!isDateNotAbsurd(start, { minYear, maxFutureYears }) || !isDateNotAbsurd(end, { minYear, maxFutureYears })) {
    errores.push('Las fechas ingresadas est\u00e1n fuera del rango permitido para el sistema');
  }

  const today = toDateOnly();

  if (!allowPast && (start < today || end < today)) {
    errores.push('No se permiten fechas pasadas');
  }

  if (allowSameDay ? end < start : end <= start) {
    errores.push(
      allowSameDay
        ? `${fieldEnd} no puede ser menor que ${fieldStart.toLowerCase()}`
        : `${fieldEnd} debe ser mayor que ${fieldStart.toLowerCase()}`
    );
  }

  if (Number.isInteger(maxDays)) {
    const days = diffDays(start, end);

    if (days !== null && days > maxDays) {
      errores.push(`El rango de fechas no debe superar ${maxDays} d\u00edas`);
    }
  }

  return errores;
};

const validateYearAllowed = (
  value,
  { minYear = 2000, maxFutureYears = 1 } = {}
) => {
  const year = Number(value);
  const maxYear = new Date().getFullYear() + maxFutureYears;

  return Number.isInteger(year) && year >= minYear && year <= maxYear;
};

module.exports = {
  addDays,
  diffDays,
  isDateNotAbsurd,
  isFutureDateOnly,
  isPastDateOnly,
  isValidDateOnly,
  parseDateOnly,
  toDateOnly,
  validateDateRange,
  validateYearAllowed
};
