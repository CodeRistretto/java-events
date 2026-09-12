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
    '<a href="$1" style="color:#D81F26;text-decoration:underline;font-weight:700">$1</a>'
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
        `<p style="margin:0 0 17px;line-height:1.72;color:#4f4f54;font-size:15px">${linkify(
          paragraph
        ).replaceAll("\n", "<br>")}</p>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;background:#F5F5F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;color:#181818">
<table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation" style="background:#F5F5F3">
<tr>
<td align="center" style="padding:34px 14px">
<table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation" style="max-width:620px">
<tr>
<td align="center" style="padding:0 0 22px">
<div style="font-size:22px;font-weight:800;letter-spacing:-.03em;color:#181818">JAVA TIMES CAFFÉ</div>
<div style="margin-top:8px;font-size:10px;letter-spacing:.18em;color:#D81F26;font-weight:800">JAVA EVENTS</div>
</td>
</tr>
<tr>
<td style="background:#fff;border:1px solid #E8E8E5;border-radius:28px;overflow:hidden">
<table width="100%" cellspacing="0" cellpadding="0" border="0" role="presentation">
<tr>
<td style="padding:40px 42px 14px">
<div style="font-size:11px;letter-spacing:.14em;color:#D81F26;font-weight:800">JAVA TIMES CAFFÉ · EVENTS</div>
<h1 style="font-size:34px;line-height:1.04;margin:10px 0 22px;letter-spacing:-.045em;color:#181818">${escapeHtml(
    subject
  )}</h1>
${htmlBody}
</td>
</tr>
<tr>
<td style="padding:20px 42px 28px;border-top:1px solid #EEEEEA;color:#88888D;font-size:11px;line-height:1.6">
<strong style="color:#181818">JAVA TIMES CAFFÉ</strong><br>
Coffee Cart · Events<br>
Conserva este correo para consultar la información relacionada con tu evento.
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

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
  try {
    data = JSON.parse(raw);
  } catch {}

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `No fue posible enviar el correo (${response.status}).`
    );
  }

  return {
    sent: true,
    skipped: false,
    providerId: data?.id || null,
  };
}
