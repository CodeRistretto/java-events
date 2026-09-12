"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function LeadCaptureEnhancer() {
  const pathname = usePathname();
  const [termsMount, setTermsMount] = useState(null);
  const [settings, setSettings] = useState({
    minimumLeadDays: 7,
    balanceDueDaysBefore: 3,
    refundPercent: 50,
    cartLengthCm: 320,
    cartWidthCm: 150,
    passageCm: 100,
    rescheduleExtraHours: 2,
  });

  useEffect(() => {
    if (pathname !== "/") return;

    let cancelled = false;

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        setSettings({
          minimumLeadDays: Number(data.settings?.minimum_lead_days ?? 7),
          balanceDueDaysBefore: Number(data.settings?.balance_due_days_before ?? 3),
          refundPercent: Number(data.settings?.cancellation_refund_bps ?? 5000) / 100,
          cartLengthCm: Number(data.settings?.cart_operating_length_cm ?? 320),
          cartWidthCm: Number(data.settings?.cart_operating_width_cm ?? 150),
          passageCm: Number(data.settings?.minimum_passage_width_cm ?? 100),
          rescheduleExtraHours: Number(data.settings?.reschedule_extra_hours ?? 2),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    let createdMount = null;

    function improveCopyAndMountTerms() {
      const buttons = Array.from(document.querySelectorAll("main.app-shell button"));
      const calculate = buttons.find((button) =>
        /calcular precio del evento|ver precio de mi evento/i.test(
          String(button.textContent || "")
        )
      );

      if (calculate && calculate.textContent !== "Ver precio de mi evento") {
        calculate.textContent = "Ver precio de mi evento";
      }

      const termsCard = Array.from(document.querySelectorAll("main.app-shell .check-card")).find(
        (card) =>
          /entiendo qué estoy contratando|acepto las condiciones operativas y de reserva/i.test(
            String(card.textContent || "")
          )
      );

      if (termsCard) {
        const title = termsCard.querySelector(".check-title");
        const text = termsCard.querySelector(".check-text");
        const nextTitle = "Acepto las condiciones operativas y de reserva";
        const nextText =
          "Confirmo que revisé el precio, el acceso del lugar y las condiciones mostradas arriba. Entiendo que la fecha sólo queda confirmada con el anticipo.";

        if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
        if (text && text.textContent !== nextText) text.textContent = nextText;
      }

      if (termsCard && !document.querySelector(".java-visible-terms-mount")) {
        const node = document.createElement("div");
        node.className = "java-visible-terms-mount";
        termsCard.parentElement?.insertBefore(node, termsCard);
        createdMount = node;
        setTermsMount(node);
      }
    }

    const timer = window.setTimeout(improveCopyAndMountTerms, 120);
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".java-visible-terms-mount")) {
        improveCopyAndMountTerms();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      createdMount?.remove();
    };
  }, [pathname]);

  if (pathname !== "/" || !termsMount) return null;

  return createPortal(
    <div className="java-visible-terms">
      <div className="java-visible-terms-kicker">CONDICIONES IMPORTANTES DEL SERVICIO</div>

      <div className="java-visible-terms-grid">
        <div>
          <span>Anticipación mínima</span>
          <strong>{settings.minimumLeadDays} días</strong>
        </div>
        <div>
          <span>Saldo completo</span>
          <strong>{settings.balanceDueDaysBefore} días antes</strong>
        </div>
        <div>
          <span>Acceso mínimo</span>
          <strong>{settings.passageCm} cm libres</strong>
        </div>
        <div>
          <span>Área del Coffee Cart</span>
          <strong>{settings.cartLengthCm} × {settings.cartWidthCm} cm</strong>
        </div>
      </div>

      <div className="java-terms-detail">
        <h4>Antes de aceptar, toma en cuenta:</h4>
        <ul>
          <li>
            <strong>Fecha y pago.</strong> La fecha queda confirmada únicamente después del pago del anticipo. El saldo debe liquidarse {settings.balanceDueDaysBefore} días antes del evento.
          </li>
          <li>
            <strong>Falta de liquidación.</strong> Si el saldo no se paga dentro del plazo y el evento se cancela por esa causa, se devuelve {settings.refundPercent}% del anticipo; el resto se retiene por logística, preparación y bloqueo de fecha.
          </li>
          <li>
            <strong>Lugar apto.</strong> El cliente o venue debe proporcionar un área firme y utilizable de al menos {settings.cartLengthCm} × {settings.cartWidthCm} cm, con un recorrido de mínimo {settings.passageCm} cm libres por puertas, pasillos y elevadores.
          </li>
          <li>
            <strong>Acceso y montaje.</strong> Restricciones no informadas, escaleras, puertas angostas, elevadores insuficientes, falta de acceso de descarga o impedimentos del venue pueden impedir o retrasar el servicio.
          </li>
          <li>
            <strong>Electricidad.</strong> El lugar debe contar con una conexión eléctrica adecuada y accesible. Fallas del inmueble o cortes ajenos a Java pueden limitar temporalmente la operación.
          </li>
          <li>
            <strong>Agua.</strong> Java lleva su agua potable; no es obligatorio que el venue proporcione una toma de agua potable para el Coffee Cart.
          </li>
          <li>
            <strong>Alergias.</strong> El cliente debe informar alergias o restricciones alimentarias antes del evento. Trabajamos con ingredientes que pueden incluir leche, soya, nueces u otros alérgenos y no podemos garantizar un ambiente totalmente libre de contacto cruzado.
          </li>
          <li>
            <strong>Daños o pérdidas.</strong> Daños, pérdida o rotura de equipo, accesorios o propiedad de Java causados por invitados, personal del venue o terceros podrán generar cargos adicionales documentados.
          </li>
          <li>
            <strong>Exterior y clima.</strong> En eventos exteriores debe existir una zona razonablemente segura y protegida. Lluvia, viento extremo, calor, riesgo eléctrico u otras condiciones inseguras pueden obligar a pausar o suspender el servicio.
          </li>
          <li>
            <strong>Retrasos.</strong> Retrasos atribuibles al cliente o al venue no extienden automáticamente el horario contratado. El tiempo adicional se cobra conforme a la tarifa vigente.
          </li>
          <li>
            <strong>Reprogramación.</strong> Si el lugar resulta no apto o el evento requiere cambio de fecha, la reprogramación no es automática ni gratuita: depende de disponibilidad y, cuando proceda, tendrá un cargo equivalente a {settings.rescheduleExtraHours} horas adicionales, además de costos no recuperables que ya se hubieran generado.
          </li>
          <li>
            <strong>Cambios.</strong> Cambios de invitados, horario, ubicación, menú o condiciones operativas pueden modificar el precio y están sujetos a disponibilidad.
          </li>
        </ul>

        <p className="java-terms-legal-note">
          Estas condiciones operativas no eliminan derechos que por ley no puedan renunciarse ni cubren actos imputables a Java que legalmente no puedan excluirse.
        </p>
      </div>
    </div>,
    termsMount
  );
}
