"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PublicCopyEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function sync() {
      document.querySelectorAll(".java-events-hero-proof span").forEach((node) => {
        if (/shopify/i.test(node.textContent || "")) node.textContent = "Pago seguro";
      });

      document.querySelectorAll(".hold-card .quote-card .caption").forEach((node) => {
        if (!/shopify/i.test(node.textContent || "")) return;
        node.textContent =
          "Al continuar, abrirás el pago seguro del anticipo y podrás seguir el estado de tu evento.";
      });
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
