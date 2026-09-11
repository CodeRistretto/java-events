import { shopifyGraphQL } from "@/lib/shopify";
import { normalizeMexicoPhone } from "@/lib/phone";

// ============================================
// JAVA EVENTS
// SHOPIFY CUSTOMER RESOLUTION
// ============================================

// ============================================
// DIVIDIR NOMBRE
// ============================================

function splitName(fullName) {
  const cleanName = String(fullName || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleanName) {
    return {
      firstName: "Cliente",
      lastName: "",
    };
  }

  const parts = cleanName.split(" ");

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// ============================================
// BUSCAR POR TELÉFONO
// ============================================

async function findCustomerByPhone(phone) {
  const query = `
    query JavaCustomerByPhone(
      $identifier: CustomerIdentifierInput!
    ) {
      customer: customerByIdentifier(
        identifier: $identifier
      ) {
        id
        email
        phone
        firstName
        lastName
      }
    }
  `;

  const data = await shopifyGraphQL(
    query,
    {
      identifier: {
        phoneNumber: phone,
      },
    }
  );

  return data?.customer || null;
}

// ============================================
// BUSCAR POR EMAIL
// ============================================

async function findCustomerByEmail(email) {
  const query = `
    query JavaCustomerByEmail(
      $identifier: CustomerIdentifierInput!
    ) {
      customer: customerByIdentifier(
        identifier: $identifier
      ) {
        id
        email
        phone
        firstName
        lastName
      }
    }
  `;

  const data = await shopifyGraphQL(
    query,
    {
      identifier: {
        emailAddress: email,
      },
    }
  );

  return data?.customer || null;
}

// ============================================
// ACTUALIZAR SOLAMENTE NOMBRE
//
// Se usa cuando encontramos al cliente por
// teléfono.
//
// NO volvemos a mandar phone.
// NO cambiamos email.
//
// Esto evita:
// "Phone has already been taken"
// "Email has already been taken"
// ============================================

async function updateExistingPhoneCustomer({
  customer,
  customerName,
}) {
  const {
    firstName,
    lastName,
  } = splitName(customerName);

  const mutation = `
    mutation JavaExistingCustomerUpdate(
      $input: CustomerInput!
    ) {
      customerUpdate(input: $input) {
        customer {
          id
          email
          phone
          firstName
          lastName
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphQL(
    mutation,
    {
      input: {
        id: customer.id,

        firstName,

        lastName:
          lastName || undefined,
      },
    }
  );

  const payload =
    data?.customerUpdate;

  const errors =
    payload?.userErrors || [];

  if (errors.length > 0) {
    // El cliente ya existe.
    // Un problema actualizando el nombre no
    // debe impedir que pueda comprar otra vez.
    console.warn(
      "Could not update existing Shopify customer name:",
      errors
    );

    return customer;
  }

  return (
    payload?.customer ||
    customer
  );
}

// ============================================
// ACTUALIZAR CLIENTE ENCONTRADO POR EMAIL
//
// Ya comprobamos antes que el teléfono NO
// pertenece a otro cliente.
//
// Por eso aquí sí podemos agregar el teléfono.
// ============================================

async function updateEmailCustomer({
  customer,
  phone,
  customerName,
}) {
  const {
    firstName,
    lastName,
  } = splitName(customerName);

  const mutation = `
    mutation JavaEmailCustomerUpdate(
      $input: CustomerInput!
    ) {
      customerUpdate(input: $input) {
        customer {
          id
          email
          phone
          firstName
          lastName
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphQL(
    mutation,
    {
      input: {
        id: customer.id,

        phone,

        firstName,

        lastName:
          lastName || undefined,
      },
    }
  );

  const payload =
    data?.customerUpdate;

  const errors =
    payload?.userErrors || [];

  if (errors.length > 0) {
    throw new Error(
      errors
        .map(
          (error) =>
            error.message
        )
        .join(" | ")
    );
  }

  if (!payload?.customer?.id) {
    throw new Error(
      "Shopify no pudo actualizar el cliente."
    );
  }

  return payload.customer;
}

// ============================================
// CREAR CLIENTE NUEVO
// ============================================

async function createCustomer({
  email,
  phone,
  customerName,
}) {
  const {
    firstName,
    lastName,
  } = splitName(customerName);

  const mutation = `
    mutation JavaCustomerCreate(
      $input: CustomerInput!
    ) {
      customerCreate(input: $input) {
        customer {
          id
          email
          phone
          firstName
          lastName
        }

        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphQL(
    mutation,
    {
      input: {
        email,

        phone,

        firstName,

        lastName:
          lastName || undefined,

        tags: [
          "JAVA_EVENTS",
          "JAVA_COFFEE_CART",
        ],

        note:
          "Cliente creado por Java Events.",
      },
    }
  );

  const payload =
    data?.customerCreate;

  const errors =
    payload?.userErrors || [];

  if (errors.length > 0) {
    throw new Error(
      errors
        .map(
          (error) =>
            error.message
        )
        .join(" | ")
    );
  }

  if (!payload?.customer?.id) {
    throw new Error(
      "Shopify no pudo crear el cliente."
    );
  }

  return payload.customer;
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

export async function ensureShopifyCustomer({
  email,
  phone,
  customerName,
}) {
  const cleanEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const normalizedPhone =
    normalizeMexicoPhone(
      phone
    );

  if (!cleanEmail) {
    throw new Error(
      "El correo electrónico es obligatorio."
    );
  }

  if (!normalizedPhone) {
    throw new Error(
      "El teléfono debe ser un número mexicano válido de 10 dígitos."
    );
  }

  // ============================================
  // PASO 1
  // BUSCAR PRIMERO POR TELÉFONO
  //
  // El teléfono es único en Shopify.
  //
  // Si existe:
  // reutilizamos ese cliente.
  // ============================================

  const phoneCustomer =
    await findCustomerByPhone(
      normalizedPhone
    );

  if (phoneCustomer) {
    console.log(
      "Java Events: existing Shopify customer found by phone:",
      phoneCustomer.id
    );

    return updateExistingPhoneCustomer({
      customer:
        phoneCustomer,

      customerName,
    });
  }

  // ============================================
  // PASO 2
  // NO EXISTE EL TELÉFONO.
  //
  // BUSCAR POR EMAIL
  // ============================================

  const emailCustomer =
    await findCustomerByEmail(
      cleanEmail
    );

  if (emailCustomer) {
    console.log(
      "Java Events: existing Shopify customer found by email:",
      emailCustomer.id
    );

    return updateEmailCustomer({
      customer:
        emailCustomer,

      phone:
        normalizedPhone,

      customerName,
    });
  }

  // ============================================
  // PASO 3
  // NO EXISTE TELÉFONO NI EMAIL.
  //
  // CREAR CLIENTE NUEVO.
  // ============================================

  console.log(
    "Java Events: creating new Shopify customer"
  );

  return createCustomer({
    email:
      cleanEmail,

    phone:
      normalizedPhone,

    customerName,
  });
}