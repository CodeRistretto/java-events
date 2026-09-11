import Link from "next/link";

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #343434",
  background: "#171717",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#090909" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(9, 9, 9, 0.96)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #252525",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1400,
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#ff7541",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.6,
              }}
            >
              JAVA TIMES CAFFÉ · EVENTS
            </div>

            <div
              style={{
                color: "#ffffff",
                marginTop: 3,
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              Admin Control Center
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/admin" style={linkStyle}>
              Admin
            </Link>

            <Link
              href="/admin/events"
              style={{
                ...linkStyle,
                borderColor: "rgba(240,90,34,.55)",
              }}
            >
              Calendar & Events
            </Link>

            <Link
              href="/admin/payments"
              style={{
                ...linkStyle,
                borderColor: "rgba(240,90,34,.55)",
              }}
            >
              Payments
            </Link>

            <Link href="/" style={linkStyle}>
              Cotizador
            </Link>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
