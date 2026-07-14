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

      const points: [number, number][] = [];
      for (const item of cases) {
        if (item.latitude === undefined || item.longitude === undefined) continue;
        const point: [number, number] = [item.latitude, item.longitude];
        points.push(point);
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = `${item.id} · ${item.name}`;
        const status = document.createElement("div");
        status.textContent = statusLabels[item.status];
        const address = document.createElement("div");
        address.textContent = item.address;
        popup.append(title, status, address);
        L.circleMarker(point, {
          radius: 9,
          color: item.status === "deviation" ? "#b42318" : item.status === "awaiting_takeover" ? "#b76609" : "#007c7c",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 4,
        }).addTo(instance).bindPopup(popup);
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
