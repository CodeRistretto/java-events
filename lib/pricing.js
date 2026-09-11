export function calculateEventPrice({
  guests,
  hours,
  matchaBar,
  extraBarista,
}) {
  const numberGuests = Number(guests);
  const numberHours = Number(hours);

  if (!numberGuests || numberGuests < 1) {
    throw new Error("Número de invitados inválido");
  }

  if (!numberHours || numberHours < 1) {
    throw new Error("Duración inválida");
  }

  // PRECIOS TEMPORALES PARA CONSTRUIR EL SISTEMA.
  // Luego pondremos aquí el tarifario real de Java.

  const BASE_PRICE = 5000;
  const INCLUDED_GUESTS = 50;
  const INCLUDED_HOURS = 2;

  const EXTRA_GUEST_PRICE = 60;
  const EXTRA_HOUR_PRICE = 1200;

  const MATCHA_BAR_PRICE = 1500;
  const EXTRA_BARISTA_PRICE = 1000;

  let total = BASE_PRICE;

  if (numberGuests > INCLUDED_GUESTS) {
    total +=
      (numberGuests - INCLUDED_GUESTS) *
      EXTRA_GUEST_PRICE;
  }

  if (numberHours > INCLUDED_HOURS) {
    total +=
      (numberHours - INCLUDED_HOURS) *
      EXTRA_HOUR_PRICE;
  }

  if (matchaBar) {
    total += MATCHA_BAR_PRICE;
  }

  if (extraBarista) {
    total += EXTRA_BARISTA_PRICE;
  }

  const deposit = Math.round(total * 0.30);
  const balance = total - deposit;

  return {
    total,
    deposit,
    balance,
    currency: "MXN",
  };
}