function dateOnlyParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function localTodayMexico() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function utcDateNumber(value) {
  const parts = dateOnlyParts(value);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function daysUntilEvent(eventDate) {
  const event = utcDateNumber(eventDate);
  const today = utcDateNumber(localTodayMexico());
  if (event === null || today === null) return null;
  return Math.round((event - today) / 86400000);
}

export function assertMinimumLeadTime(eventDate, minimumLeadDays = 7) {
  const required = Math.max(0, Number(minimumLeadDays || 0));
  const days = daysUntilEvent(eventDate);
  if (days === null) throw new Error("La fecha del evento no es válida.");
  if (days < required) {
    throw new Error(
      `Los eventos deben reservarse con al menos ${required} días de anticipación. Selecciona una fecha posterior.`
    );
  }
  return days;
}

export function balancePaymentDeadline(eventDate, daysBefore = 3) {
  const parts = dateOnlyParts(eventDate);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(daysBefore || 0)));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T23:59:59-06:00`;
}
