export function renderEventEmailTemplate(template, values = {}) {
  const replace = (input) =>
    String(input || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const value = values[key];
      return value === null || value === undefined ? "" : String(value);
    });

  return {
    subject: replace(template?.subject_template),
    body: replace(template?.body_template),
  };
}

export function moneyMx(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(cents || 0) / 100);
}

export function prettyEventDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}
