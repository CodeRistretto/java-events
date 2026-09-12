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

function setReactInputByLabel(labelText, value) {
  if (!value) return;
  const field = findFieldByLabel(labelText);
  const input = field?.querySelector("input");
  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  if (setter) setter.call(input, value);
  else input.value = value;

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

function splitCityState(label) {
  const parts = String(label || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city: parts[0] || "",
    state: parts.slice(1).join(", ") || "",
  };
}

async function geocodeAddress({ cityLabel, street, neighborhood, postalCode }) {
  const { city, state } = splitCityState(cityLabel);
  const candidates = [
    [street, neighborhood, postalCode, city, state, "México"],
    [neighborhood, postalCode, city, state, "México"],
    [postalCode, city, state, "México"],
    [city, state, "México"],
  ];

  for (const parts of candidates) {
    const query = parts.filter(Boolean).join(", ");
    if (!query) continue;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "mx");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      headers: { "Accept-Language": "es-MX,es;q=0.9" },
    });

    if (!response.ok) continue;
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows[0]) continue;

    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const hasStreet = String(street || "").trim().length >= 4;
    const hasNeighborhood = String(neighborhood || "").trim().length >= 3;
    const hasPostal = String(postalCode || "").trim().length >= 4;

    return {
      lat,
      lng,
      zoom: hasStreet ? 17 : hasNeighborhood ? 15 : hasPostal ? 14 : 12,
      precision: hasStreet
        ? "ADDRESS"
        : hasNeighborhood
        ? "NEIGHBORHOOD"
        : hasPostal
        ? "POSTAL_CODE"
        : "CITY",
      displayName: rows[0].display_name || query,
    };
  }

  return null;
}

async function reverseGeocode(lat, lng) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { "Accept-Language": "es-MX,es;q=0.9" },
  });

  if (!response.ok) return null;
  const row = await response.json();
  const a = row?.address || {};

  const street =
    a.road || a.pedestrian || a.residential || a.footway || a.path || "";
  const houseNumber = a.house_number || "";
  const neighborhood =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || "";
  const postalCode = a.postcode || "";

  return {
    street: [street, houseNumber].filter(Boolean).join(" ").trim(),
    neighborhood,
    postalCode,
    displayName: row?.display_name || "",
  };
}

export default function LocationPinEnhancer() {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState(null);
  const [cityLabel, setCityLabel] = useState("");
  const [address, setAddress] = useState({
    street: "",
    neighborhood: "",
    postalCode: "",
  });
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
    let cleanupListeners = [];

    function mount() {
      const existing = document.querySelector(".java-location-pin-mount");
      if (existing) {
        currentMount = existing;
        setMountNode(existing);
        return;
      }

      const addressField = findFieldByLabel("Calle y número");
      const neighborhoodField = findFieldByLabel("Colonia");
      const postalField = findFieldByLabel("Código postal");
      const grid = addressField?.parentElement;
      if (!addressField || !neighborhoodField || !postalField || !grid) return;

      const node = document.createElement("div");
      node.className = "java-location-pin-mount";
      // Keep the address fields and the map inside the SAME grid/visual section.
      grid.appendChild(node);
      currentMount = node;
      setMountNode(node);

      const streetInput = addressField.querySelector("input");
      const neighborhoodInput = neighborhoodField.querySelector("input");
      const postalInput = postalField.querySelector("input");
      const citySelect = document.querySelector("main.app-shell select.select");

      const readAddress = () => {
        setAddress({
          street: streetInput?.value || "",
          neighborhood: neighborhoodInput?.value || "",
          postalCode: postalInput?.value || "",
        });
      };

      const readCity = () => {
        const label = citySelect?.selectedOptions?.[0]?.textContent || "";
        setCityLabel(label);
      };

      const cityChanged = () => {
        readCity();
        setCoords(null);
      };

      readAddress();
      readCity();

      const stored = readStoredPin();
      if (stored) setCoords(stored);

      [streetInput, neighborhoodInput, postalInput].forEach((input) => {
        if (!input) return;
        input.addEventListener("input", readAddress);
        input.addEventListener("change", readAddress);
        cleanupListeners.push(() => {
          input.removeEventListener("input", readAddress);
          input.removeEventListener("change", readAddress);
        });
      });

      if (citySelect) {
        citySelect.addEventListener("change", cityChanged);
        cleanupListeners.push(() => citySelect.removeEventListener("change", cityChanged));
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
      cleanupListeners.forEach((cleanup) => cleanup());
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
      address={address}
      coords={coords}
      onChange={setCoords}
    />,
    mountNode
  );
}

function LocationPinPicker({ cityLabel, address, coords, onChange }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const placeRef = useRef(null);
  const reverseRequestRef = useRef(0);
  const [status, setStatus] = useState("Cargando mapa...");
  const [geoBusy, setGeoBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [pinSource, setPinSource] = useState(coords ? "saved" : "none");

  const cityCenter = useMemo(() => centerForCity(cityLabel), [cityLabel]);

  async function fillAddressFromPin(point) {
    const requestId = Date.now();
    reverseRequestRef.current = requestId;
    setReverseBusy(true);

    try {
      const result = await reverseGeocode(point.lat, point.lng);
      if (reverseRequestRef.current !== requestId || !result) return;

      if (result.street) setReactInputByLabel("Calle y número", result.street);
      if (result.neighborhood) setReactInputByLabel("Colonia", result.neighborhood);
      if (result.postalCode) setReactInputByLabel("Código postal", result.postalCode);

      setStatus(
        result.street
          ? "Dirección encontrada desde el pin. Revísala y corrige cualquier detalle si hace falta."
          : "Pin confirmado. No encontramos un número de calle exacto; completa la dirección manualmente."
      );
    } catch {
      setStatus(
        "Pin confirmado. No pudimos completar la dirección automáticamente; puedes escribirla manualmente."
      );
    } finally {
      if (reverseRequestRef.current === requestId) setReverseBusy(false);
    }
  }

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

        function place(lat, lng, options = {}) {
          const {
            zoom = 17,
            moveMap = true,
            source = "manual",
            message = "Ubicación exacta seleccionada",
            commit = true,
            reverse = false,
          } = options;

          const next = {
            lat: Number(Number(lat).toFixed(6)),
            lng: Number(Number(lng).toFixed(6)),
          };

          if (!markerRef.current) {
            markerRef.current = L.marker([next.lat, next.lng], {
              draggable: true,
              icon: pinIcon,
            }).addTo(map);

            markerRef.current.on("dragend", (event) => {
              const point = event.target.getLatLng();
              place(point.lat, point.lng, {
                moveMap: false,
                source: "manual",
                message: "Ubicación exacta confirmada manualmente",
                commit: true,
                reverse: true,
              });
            });
          } else {
            markerRef.current.setLatLng([next.lat, next.lng]);
          }

          if (moveMap) map.setView([next.lat, next.lng], zoom, { animate: true });
          if (commit) onChange(next);
          setPinSource(source);
          setStatus(message);
          if (reverse) fillAddressFromPin(next);
        }

        placeRef.current = place;

        map.on("click", (event) =>
          place(event.latlng.lat, event.latlng.lng, {
            source: "manual",
            message: "Ubicación exacta confirmada manualmente",
            commit: true,
            reverse: true,
          })
        );

        mapRef.current = map;
        setStatus(
          coords
            ? "Ubicación exacta seleccionada"
            : "Escribe la dirección o coloca el pin directamente en el mapa"
        );

        setTimeout(() => map.invalidateSize(), 80);
      })
      .catch(() =>
        setStatus("No fue posible cargar el mapa. Recarga la página e inténtalo de nuevo.")
      );

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        placeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!coords && pinSource !== "address") {
      markerRef.current?.remove();
      markerRef.current = null;
      map.setView(cityCenter, 13, { animate: true });
    }
  }, [cityCenter[0], cityCenter[1], coords, pinSource]);

  useEffect(() => {
    if (!mapRef.current) return;

    const timer = setTimeout(async () => {
      setAddressBusy(true);

      try {
        const result = await geocodeAddress({ cityLabel, ...address });
        const map = mapRef.current;
        if (!map || !result) {
          onChange(null);
          setStatus(
            "No encontramos esa dirección automáticamente. Puedes colocar el pin manualmente."
          );
          return;
        }

        const hasStreet = String(address.street || "").trim().length >= 4;

        if (hasStreet && placeRef.current) {
          placeRef.current(result.lat, result.lng, {
            zoom: result.zoom,
            source: "address",
            message:
              "Ubicación estimada por la dirección. Revisa el pin y muévelo si es necesario.",
            commit: true,
            reverse: false,
          });
        } else {
          // Never keep stale coordinates after the address was cleared/changed.
          onChange(null);
          markerRef.current?.remove();
          markerRef.current = null;
          map.setView([result.lat, result.lng], result.zoom, { animate: true });
          setPinSource("preview");
          setStatus(
            result.precision === "POSTAL_CODE"
              ? "Mapa actualizado con el código postal. Agrega calle y número o coloca el pin."
              : result.precision === "NEIGHBORHOOD"
              ? "Mapa actualizado con la colonia. Agrega calle y número o coloca el pin."
              : "Mapa actualizado con la ciudad y el estado."
          );
        }
      } catch {
        onChange(null);
        setStatus(
          "No pudimos actualizar el mapa automáticamente. Puedes colocar el pin manualmente."
        );
      } finally {
        setAddressBusy(false);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [cityLabel, address.street, address.neighborhood, address.postalCode]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("Este navegador no permite obtener tu ubicación.");
      return;
    }

    setGeoBusy(true);
    setStatus("Buscando tu ubicación...");

    navigator.geolocation.getCurrentPosition(
      ({ coords: current }) => {
        if (placeRef.current) {
          placeRef.current(current.latitude, current.longitude, {
            zoom: 17,
            source: "device",
            message: "Ubicación exacta obtenida desde tu dispositivo",
            commit: true,
            reverse: true,
          });
        }
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
          <div className="java-location-kicker">DIRECCIÓN + UBICACIÓN EXACTA</div>
          <h4>Escribe la dirección o coloca directamente el pin</h4>
          <p>
            Si colocas o mueves el pin, Java intentará completar automáticamente la
            calle, número, colonia y código postal encontrados. Revisa siempre los
            datos antes de apartar.
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
            <strong>
              {reverseBusy
                ? "Buscando calle y número desde el pin..."
                : addressBusy
                ? "Actualizando mapa..."
                : status}
            </strong>
            <small>
              {coords
                ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} · Puedes mover el pin arrastrándolo.`
                : [address.postalCode, cityLabel].filter(Boolean).join(" · ") ||
                  "Completa la dirección o toca el mapa para ubicar el evento"}
            </small>
          </div>
        </div>
      </div>

      <div className="java-location-note">
        <strong>Importante:</strong> el pin debe señalar el acceso real por donde llegará
        el equipo. Si OpenStreetMap no encuentra un número exacto, completa o corrige
        manualmente la dirección antes de continuar.
      </div>
    </section>
  );
}
