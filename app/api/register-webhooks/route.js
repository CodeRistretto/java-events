import { shopifyGraphQL } from "@/lib/shopify";

export const runtime = "nodejs";

export async function POST(
  request
) {
  try {
    // ============================================
    // PROTEGER ESTE ENDPOINT
    // ============================================

    const providedSecret =
      request.headers.get(
        "x-setup-secret"
      );

    const expectedSecret =
      process.env
        .WEBHOOK_SETUP_SECRET;

    if (
      !expectedSecret ||
      providedSecret !==
        expectedSecret
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // ============================================
    // URL PÚBLICA
    // ============================================

    const baseUrl =
      process.env
        .APP_BASE_URL;

    if (!baseUrl) {
      throw new Error(
        "Falta APP_BASE_URL."
      );
    }

    const cleanBaseUrl =
      baseUrl
        .trim()
        .replace(
          /\/+$/,
          ""
        );

    const webhookUrl =
      `${cleanBaseUrl}/api/webhooks/orders-paid`;

    // ============================================
    // CREAR SUSCRIPCIÓN
    // ============================================

    const mutation = `
      mutation CreateOrdersPaidWebhook(
        $topic: WebhookSubscriptionTopic!,
        $webhookSubscription: WebhookSubscriptionInput!
      ) {
        webhookSubscriptionCreate(
          topic: $topic
          webhookSubscription: $webhookSubscription
        ) {
          webhookSubscription {
            id
            topic
            uri
          }

          userErrors {
            field
            message
          }
        }
      }
    `;

    const data =
      await shopifyGraphQL(
        mutation,
        {
          topic:
            "ORDERS_PAID",

          webhookSubscription: {
            uri:
              webhookUrl,
          },
        }
      );

    const payload =
      data
        ?.webhookSubscriptionCreate;

    const errors =
      payload
        ?.userErrors ||
      [];

    if (
      errors.length > 0
    ) {
      return Response.json(
        {
          success: false,

          error:
            errors
              .map(
                (item) =>
                  item.message
              )
              .join(" | "),
        },
        {
          status: 400,
        }
      );
    }

    return Response.json({
      success: true,

      webhook:
        payload
          ?.webhookSubscription,

      callbackUrl:
        webhookUrl,
    });
  } catch (error) {
    console.error(
      "Register webhooks error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error.message ||
          "No fue posible registrar el webhook.",
      },
      {
        status: 500,
      }
    );
  }
}