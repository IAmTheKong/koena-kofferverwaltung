"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { CaseItem } from "../../lib/domain";
import { statusLabels } from "../../lib/domain";

const SUMMERAU: [number, number] = [48.5523035, 14.4472737];

export default function CaseMap({ cases }: { cases: CaseItem[] }) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;

    async function initialize() {
      const L = await import("leaflet");
      if (cancelled || !container.current) return;
      map.current?.remove();
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(SUMMERAU, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
      }).addTo(instance);

      const grouped = new Map<string, { point: [number, number]; items: CaseItem[] }>();
      for (const item of cases) {
        if (item.latitude === undefined || item.longitude === undefined) continue;
        const point: [number, number] = [item.latitude, item.longitude];
        const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
        const group = grouped.get(key) ?? { point, items: [] };
        group.items.push(item);
        grouped.set(key, group);
      }

      const points: [number, number][] = [];
      for (const { point, items } of grouped.values()) {
        points.push(point);
        const hasDeviation = items.some((item) => item.status === "deviation" || item.status === "out_of_service");
        const isWaiting = items.some((item) => item.status === "awaiting_takeover");
        const tone = hasDeviation ? "danger" : isWaiting ? "warning" : "normal";
        const count = items.length > 1 ? `<b class="case-map-count">${items.length}</b>` : "";
        const icon = L.divIcon({
          className: "case-map-icon",
          html: `<span class="case-map-pin ${tone}"><span>▣</span></span>${count}`,
          iconSize: [46, 54],
          iconAnchor: [23, 50],
          popupAnchor: [0, -48],
        });
        const popup = document.createElement("div");
        popup.className = "case-map-popup";
        const heading = document.createElement("strong");
        heading.textContent = items.length === 1 ? "Koffer an diesem Standort" : `${items.length} Koffer an diesem Standort`;
        popup.append(heading);
        for (const item of items) {
          const row = document.createElement("div");
          const title = document.createElement("b");
          title.textContent = `${item.id} · ${item.name}`;
          const detail = document.createElement("small");
          detail.textContent = `${statusLabels[item.status]} · Standort: ${item.location}`;
          row.append(title, detail);
          if (item.address && item.address !== item.location) {
            const address = document.createElement("small");
            address.textContent = `Adresse: ${item.address}`;
            row.append(address);
          }
          popup.append(row);
        }
        const markerTitle = items.map((item) => item.id).join(", ");
        L.marker(point, { icon, title: markerTitle, alt: `Kofferstandort: ${markerTitle}`, keyboard: true }).addTo(instance).bindPopup(popup);
      }

      if (points.length > 1) instance.fitBounds(points, { padding: [35, 35], maxZoom: 14 });
      else if (points.length === 1) instance.setView(points[0], 14);
      map.current = instance;
    }

    void initialize();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [cases]);

  return <div className="osm-map" ref={container} aria-label="OpenStreetMap mit aktuellen Kofferstandorten" />;
}
