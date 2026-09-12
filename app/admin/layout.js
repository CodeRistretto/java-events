import Link from "next/link";

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "9px 14px",
  borderRadius: 999,
  border: "1px solid rgba(29,29,31,.12)",
  background: "#ffffff",
  color: "#1d1d1f",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 650,
  whiteSpace: "nowrap",
  boxShadow: "0 2px 8px rgba(0,0,0,.025)",
};

export default function AdminLayout({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255,255,255,.88)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          borderBottom: "1px solid rgba(29,29,31,.08)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "11px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
              JAVA TIMES CAFFÉ · EVENTS
            </div>
            <div style={{ color: "#1d1d1f", marginTop: 3, fontSize: 16, fontWeight: 650, letterSpacing: "-.02em" }}>
              Admin Control Center
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin" style={linkStyle}>Admin</Link>
            <Link href="/admin/events" style={{ ...linkStyle, borderColor: "rgba(240,90,34,.25)", background: "#fff7f2" }}>Calendar & Events</Link>
            <Link href="/admin/payments" style={{ ...linkStyle, borderColor: "rgba(240,90,34,.25)", background: "#fff7f2" }}>Payments</Link>
            <Link href="/admin/service" style={{ ...linkStyle, borderColor: "rgba(240,90,34,.25)", background: "#fff7f2" }}>Service & Terms</Link>
            <Link href="/admin/website" style={{ ...linkStyle, borderColor: "rgba(240,90,34,.25)", background: "#fff7f2" }}>Website & Images</Link>
            <Link href="/" style={linkStyle}>Cotizador</Link>
            <form action="/api/admin/logout" method="post" style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  ...linkStyle,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#9f1522",
                  background: "#fff7f7",
                  borderColor: "rgba(215,0,21,.15)",
                }}
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
