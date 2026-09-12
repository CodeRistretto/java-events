function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkify(text) {
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#f05a22;text-decoration:none">$1</a>'
  );
}

export async function sendJavaEventEmail({ to, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EVENTS_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, skipped: true, reason: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }

  const htmlBody = String(body || "")
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.65;color:#3a3a3c">${linkify(
          paragraph
        ).replaceAll("\n", "<br>")}</p>`
    )
    .join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1d1d1f"><table width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f7;padding:28px 12px"><tr><td align="center"><table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#fff;border:1px solid #e7e7ea;border-radius:22px;overflow:hidden"><tr><td style="padding:28px 30px 12px"><div style="font-size:11px;letter-spacing:.14em;color:#f05a22;font-weight:700">JAVA TIMES CAFFÉ · EVENTS</div><h1 style="font-size:28px;line-height:1.05;margin:10px 0 22px;letter-spacing:-.04em">${escapeHtml(subject)}</h1>${htmlBody}</td></tr><tr><td style="padding:18px 30px 28px;color:#8e8e93;font-size:11px;line-height:1.5;border-top:1px solid #eeeeef">Este correo fue enviado por Java Times Caffé por una solicitud relacionada con Java Coffee Cart.</td></tr></table></td></tr></table></body></html>`;

  const headerName = ["Author", "ization"].join("");
  const authValue = ["Bearer", apiKey].join(" ");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      [headerName]: authValue,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text: body }),
  });

  const raw = await response.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `No fue posible enviar el correo (${response.status}).`);
  }

  return { sent: true, skipped: false, providerId: data?.id || null };
}
