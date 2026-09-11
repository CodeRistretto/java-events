import { createClient } from "@supabase/supabase-js";

// ============================================
// JAVA EVENTS
// SUPABASE ADMIN CLIENT
// ============================================

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Falta SUPABASE_URL en .env.local"
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    "Falta SUPABASE_SECRET_KEY en .env.local"
  );
}

// ============================================
// WAIT
// ============================================

function wait(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

// ============================================
// DETECTAR EL BUG TRANSITORIO
// DE SUPABASE / POSTGREST
// ============================================

async function isJwtFutureError(
  response
) {
  if (
    response.status !== 401
  ) {
    return false;
  }

  try {
    const clone =
      response.clone();

    const text =
      await clone.text();

    return (
      text.includes(
        "JWT issued at future"
      ) ||
      text.includes(
        "PGRST303"
      )
    );
  } catch {
    return false;
  }
}

// ============================================
// FETCH CON RETRY
// ============================================

async function fetchWithRetry(
  input,
  init
) {
  const delays = [
    0,
    500,
    1200,
    2500,
  ];

  let lastResponse;

  for (
    let attempt = 0;
    attempt < delays.length;
    attempt++
  ) {
    if (
      delays[attempt] > 0
    ) {
      await wait(
        delays[attempt]
      );
    }

    const response =
      await fetch(
        input,
        init
      );

    lastResponse =
      response;

    const jwtFuture =
      await isJwtFutureError(
        response
      );

    if (!jwtFuture) {
      return response;
    }

    console.warn(
      `Supabase PGRST303 detected. Retry ${attempt + 1}/${delays.length}`
    );
  }

  return lastResponse;
}

// ============================================
// CLIENT
// ============================================

export const supabaseAdmin =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },

      global: {
        fetch:
          fetchWithRetry,
      },
    }
  );