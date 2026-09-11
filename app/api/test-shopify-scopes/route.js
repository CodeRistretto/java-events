import { shopifyGraphQL } from "@/lib/shopify";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await shopifyGraphQL(`
      query JavaEventsAccessScopes {
        currentAppInstallation {
          accessScopes {
            handle
          }
        }
      }
    `);

    const scopes =
      data?.currentAppInstallation?.accessScopes?.map(
        (scope) => scope.handle
      ) || [];

    return Response.json({
      success: true,

      hasReadCustomers:
        scopes.includes("read_customers"),

      hasWriteCustomers:
        scopes.includes("write_customers"),

      hasReadDraftOrders:
        scopes.includes("read_draft_orders"),

      hasWriteDraftOrders:
        scopes.includes("write_draft_orders"),

      hasReadOrders:
        scopes.includes("read_orders"),

      scopes: scopes.sort(),
    });
  } catch (error) {
    console.error(
      "Shopify scopes test:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "No fue posible consultar los permisos de Shopify.",
      },
      {
        status: 500,
      }
    );
  }
}