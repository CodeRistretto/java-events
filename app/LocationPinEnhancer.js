"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "java-event-location-pin";

const CITY_CENTERS = {
  "torreón, coahuila": [25.5428, -103.4068],
  "torreon, coahuila": [25.5428, -103.4068],
  "gómez palacio, durango": [25.5699, -103.4954],
  "gomez palacio, durango": [25.5699, -103.4954],
  "lerdo, durango": [25.5376, -103.5248],
};

function centerForCity(label) {
  const key = String(label || "").trim().toLowerCase();
  return CITY_CENTERS[key] || [25.55, -103.44];
}

function ensureLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.L) return Promise.resolve(window.L);

  if (!document.getElementById("java-leaflet-css")) {
    const link = document.createElement("link");
    link.id = "java-leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("java-leaflet-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "java-leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("No fue posible cargar el mapa."));
    document.head.appendChild(script);
  });
}

function findFieldByLabel(text) {
  const fields = Array.from(document.querySelectorAll("main.app-shell .field"));
  return (
    fields.find((field) => {
      const label = field.querySelector("label");
      return label?.textContent?.trim().toLowerCase() === text.toLowerCase();
    }) || null
  );
}

function readStoredPin() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function savePin(coords) {
  try {
    if (!coords) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {}
}

export default function LocationPinEnhancer() {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState(null);
  const [cityLabel, setCityLabel] = useState("");
  const [coords, setCoords] = useState(null);
  const coordsRef = useRef(null);

  useEffect(() => {
    coordsRef.current = coords;
    savePin(coords);
  }, [coords]);

  useEffect(() => {
    if (pathname !== "/") {
      setMountNode(null);
      return;
    }

    let currentMount = null;
    let citySelect = null;
    let cleanupCity = null;

    function mount() {
      const existing = document.querySelector(".java-location-pin-mount");
      if (existing) {
        currentMount = existing;
        setMountNode(existing);
        return;
      }

      const addressField = findFieldByLabel("Calle y número");
      const postalField = findFieldByLabel("Código postal");
      const grid = addressField?.parentElement;
      if (!addressField || !postalField || !grid) return;

      const node = document.createElement("div");
      node.className = "java-location-pin-mount";
      grid.parentElement?.insertBefore(node, grid.nextSibling);
      currentMount = node;
      setMountNode(node);

      citySelect = document.querySelector("main.app-shell select.select");
      const updateCity = () => {
        const label = citySelect?.selectedOptions?.[0]?.textContent || "";
        setCityLabel(label);
        setCoords(null);
      };

      const initialLabel = citySelect?.selectedOptions?.[0]?.textContent || "";
      setCityLabel(initialLabel);

      const stored = readStoredPin();
      if (stored) setCoords(stored);

      if (citySelect) {
        citySelect.addEventListener("change", updateCity);
        cleanupCity = () => citySelect?.removeEventListener("change", updateCity);
      }
    }

    const timer = setTimeout(mount, 80);
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".java-location-pin-mount")) mount();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      cleanupCity?.();
      currentMount?.remove();
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";

      if (url.includes("/api/hold") && init?.method?.toUpperCase() === "POST") {
        const pin = coordsRef.current;

        if (!pin) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "Selecciona la ubicación exacta del evento colocando el pin en el mapa.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (typeof init.body === "string") {
          try {
            const body = JSON.parse(init.body);
            body.latitude = pin.lat;
            body.longitude = pin.lng;
            init = { ...init, body: JSON.stringify(body) };
          } catch {}
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  if (!mountNode) return null;

  return createPortal(
    <LocationPinPicker
      cityLabel={cityLabel}
      coords={coords}
      onChange={setCoords}
    />,
    mountNode
  );
}

function LocationPinPicker({ cityLabel, coords, onChange }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [status, setStatus] = useState("Cargando mapa...");
  const [geoBusy, setGeoBusy] = useState(false);

  const cityCenter = useMemo(() => centerForCity(cityLabel), [cityLabel]);

  useEffect(() => {
    let cancelled = false;

    ensureLeaflet()
      .then((L) => {
        if (cancelled || !mapEl.current || mapRef.current) return;

        const initial = coords ? [coords.lat, coords.lng] : cityCenter;
        const map = L.map(mapEl.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView(initial, coords ? 17 : 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: "java-map-pin-shell",
          html: '<div class="java-map-pin-dot"><span></span></div>',
          iconSize: [38, 46],
          iconAnchor: [19, 43],
        });

        function place(lat, lng, zoom = true) {
          const next = {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          };

          if (!markerRef.current) {
            markerRef.current = L.marker([next.lat, next.lng], {
              draggable: true,
              icon: pinIcon,
            }).addTo(map);

            markerRef.current.on("dragend", (event) => {
              const point = event.target.getLatLng();
              place(point.lat, point.lng, false);
            });
          } else {
            markerRef.current.setLatLng([next.lat, next.lng]);
          }

          if (zoom) map.setView([next.lat, next.lng], 17, { animate: true });
          onChange(next);
          setStatus("Ubicación exacta seleccionada");
        }

        map.on("click", (event) => place(event.latlng.lat, event.latlng.lng));
        mapRef.current = map;
        setStatus(coords ? "Ubicación exacta seleccionada" : "Haz clic en el mapa para colocar el pin");

        setTimeout(() => map.invalidateSize(), 80);
      })
      .catch(() => setStatus("No fue posible cargar el mapa. Recarga la página e inténtalo de nuevo."));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!coords) {
      markerRef.current?.remove();
      markerRef.current = null;
      map.setView(cityCenter, 13, { animate: true });
      setStatus("Haz clic en el mapa para colocar el pin");
    }
  }, [cityCenter[0], cityCenter[1], coords]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("Este navegador no permite obtener tu ubicación.");
      return;
    }

    setGeoBusy(true);
    setStatus("Buscando tu ubicación...");

    navigator.geolocation.getCurrentPosition(
      ({ coords: current }) => {
        const next = {
          lat: Number(current.latitude.toFixed(6)),
          lng: Number(current.longitude.toFixed(6)),
        };
        onChange(next);
        const map = mapRef.current;
        if (map && window.L) {
          if (!markerRef.current) {
            const pinIcon = window.L.divIcon({
              className: "java-map-pin-shell",
              html: '<div class="java-map-pin-dot"><span></span></div>',
              iconSize: [38, 46],
              iconAnchor: [19, 43],
            });
            markerRef.current = window.L.marker([next.lat, next.lng], {
              draggable: true,
              icon: pinIcon,
            }).addTo(map);
            markerRef.current.on("dragend", (event) => {
              const point = event.target.getLatLng();
              onChange({
                lat: Number(point.lat.toFixed(6)),
                lng: Number(point.lng.toFixed(6)),
              });
            });
          } else {
            markerRef.current.setLatLng([next.lat, next.lng]);
          }
          map.setView([next.lat, next.lng], 17, { animate: true });
        }
        setStatus("Ubicación exacta seleccionada");
        setGeoBusy(false);
      },
      () => {
        setStatus("No pudimos obtener tu ubicación. Coloca el pin manualmente en el mapa.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <section className="java-location-picker">
      <div className="java-location-head">
        <div>
          <div className="java-location-kicker">UBICACIÓN EXACTA</div>
          <h4>Coloca el pin donde será el evento</h4>
          <p>
            La dirección escrita nos sirve como referencia. El pin nos indica el
            punto exacto al que debe llegar el equipo de Java Coffee Cart.
          </p>
        </div>

        <button
          type="button"
          className="java-location-current"
          onClick={useMyLocation}
          disabled={geoBusy}
        >
          {geoBusy ? "Buscando..." : "⌖ Usar mi ubicación"}
        </button>
      </div>

      <div className="java-location-map-wrap">
        <div ref={mapEl} className="java-location-map" />
        <div className={`java-location-status ${coords ? "selected" : ""}`}>
          <span className="java-location-status-dot" />
          <div>
            <strong>{status}</strong>
            <small>
              {coords
                ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} · Puedes mover el pin arrastrándolo.`
                : `Zona seleccionada: ${cityLabel || "Java Events"}`}
            </small>
          </div>
        </div>
      </div>

      <div className="java-location-note">
        <strong>Importante:</strong> antes de apartar la fecha debes colocar el pin.
        Java validará que el punto se encuentre dentro de la zona de servicio configurada.
      </div>
    </section>
  );
}
