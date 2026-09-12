"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ConfirmationPaymentCTA() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/confirmation\/([^/]+)$/);
  const bookingId = match?.[1] || null;
  const [mount, setMount] = useState(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    fetch(`/api/confirmation/${encodeURIComponent(bookingId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success) setEvent(data.event);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    let node = null;

    function attach() {
      const card = document.querySelector(".confirmation-page .status-card");
      if (!card) return;
      const existing = document.querySelector(".java-confirmation-payment-mount");
      if (existing) {
        setMount(existing);
        return;
      }
      node = document.createElement("div");
      node.className = "java-confirmation-payment-mount no-print";
      card.appendChild(node);
      setMount(node);
    }

    const timer = setTimeout(attach, 100);
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      node?.remove();
    };
  }, [bookingId]);

  if (!mount || !event?.depositCheckoutUrl) return null;
  if (!["HOLD", "PAYMENT_PENDING"].includes(event.status)) return null;

  return createPortal(
    <div style={{ marginTop: 18 }}>
      <a
        href={event.depositCheckoutUrl}
        style={{
          minHeight: 48,
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 18px",
          borderRadius: 999,
          background: "#f05a22",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 700,
          boxSizing: "border-box",
        }}
      >
        Pagar anticipo en Shopify →
      </a>
      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: "#8e8e93" }}>
        Tu fecha se confirma únicamente cuando Shopify confirma el pago del anticipo.
      </div>
    </div>,
    mount
  );
}
