let cachedToken = null;
let cachedTokenExpiresAt = 0;

// ============================================
// SHOP DOMAIN
// ============================================

function getShopDomain() {
  const rawShop = process.env.SHOPIFY_SHOP;

  if (!rawShop) {
    throw new Error(
      "Falta SHOPIFY_SHOP en .env.local"
    );
  }

  let shop = rawShop
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  // Permite:
  // tienda
  // tienda.myshopify.com

  if (!shop.includes(".")) {
    shop = `${shop}.myshopify.com`;
  }

  if (!shop.endsWith(".myshopify.com")) {
    throw new Error(
      "SHOPIFY_SHOP debe ser el dominio .myshopify.com de la tienda."
    );
  }

  return shop;
}

// ============================================
// SHOPIFY ACCESS TOKEN
// ============================================

export async function getShopifyAccessToken() {
  const now = Date.now();

  // Reutilizar token mientras siga vigente.
  if (
    cachedToken &&
    cachedTokenExpiresAt > now + 60 * 1000
  ) {
    return cachedToken;
  }

  const clientId =
    process.env.SHOPIFY_CLIENT_ID;

  const clientSecret =
    process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      "Falta SHOPIFY_CLIENT_ID en .env.local"
    );
  }

  if (!clientSecret) {
    throw new Error(
      "Falta SHOPIFY_CLIENT_SECRET en .env.local"
    );
  }

  const shop = getShopDomain();

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),

      cache: "no-store",
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error(
      "Shopify auth raw response:",
      text
    );

    throw new Error(
      "Shopify devolvió una respuesta de autenticación inválida."
    );
  }

  if (
    !response.ok ||
    !data.access_token
  ) {
    console.error(
      "Shopify authentication failed:",
      {
        status: response.status,
        error:
          data.error ||
          data.error_description ||
          "Unknown authentication error",
      }
    );

    throw new Error(
      data.error_description ||
        data.error ||
        "No fue posible autenticar Java Events con Shopify."
    );
  }

  cachedToken = data.access_token;

  const expiresIn =
    Number(data.expires_in) || 86400;

  // Renovar 5 minutos antes de que expire.
  cachedTokenExpiresAt =
    Date.now() +
    Math.max(
      60,
      expiresIn - 300
    ) *
      1000;

  return cachedToken;
}

// ============================================
// SHOPIFY GRAPHQL
// ============================================

export async function shopifyGraphQL(
  query,
  variables = {}
) {
  const shop = getShopDomain();

  const accessToken =
    await getShopifyAccessToken();

  const apiVersion =
    process.env.SHOPIFY_API_VERSION ||
    "2026-07";

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "X-Shopify-Access-Token":
          accessToken,
      },

      body: JSON.stringify({
        query,
        variables,
      }),

      cache: "no-store",
    }
  );

  const text = await response.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    console.error(
      "Shopify GraphQL raw response:",
      text
    );

    throw new Error(
      "Shopify devolvió una respuesta GraphQL inválida."
    );
  }

  if (!response.ok) {
    console.error(
      "Shopify HTTP error:",
      response.status,
      json
    );

    throw new Error(
      `Shopify rechazó la solicitud (${response.status}).`
    );
  }

  if (
    json.errors &&
    json.errors.length > 0
  ) {
    console.error(
      "Shopify GraphQL errors:",
      json.errors
    );

    throw new Error(
      json.errors
        .map((error) => error.message)
        .join(" | ")
    );
  }

  return json.data;
}