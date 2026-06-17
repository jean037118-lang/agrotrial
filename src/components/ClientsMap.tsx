import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { type Client, type Sale } from "@/lib/agro";
import { Card } from "@/components/ui/card";

interface ClientsMapProps {
  clients: Client[];
  sales?: Sale[];
  selectedCities?: string[];
  selectedStates?: string[];
  routeMode?: boolean;
}

export function ClientsMap({
  clients,
  sales = [] as Sale[],
  selectedCities = [],
  selectedStates = [],
  routeMode = false,
}: ClientsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const polyline = useRef<L.Polyline | null>(null);

  // Agregar vendas por cliente
  const aggregates = useMemo(() => {
    const aggregatesMap = new Map<string, number>();
    for (const s of sales) {
      const prev = aggregatesMap.get(s.client_id) ?? 0;
      aggregatesMap.set(s.client_id, prev + Number(s.tons));
    }
    return aggregatesMap;
  }, [sales]);

  // Filtrar clientes baseado em cidade/estado
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const cityMatch = selectedCities.length === 0 || selectedCities.includes(c.city);
      const stateMatch = selectedStates.length === 0 || selectedStates.includes(c.state);
      return cityMatch && stateMatch;
    });
  }, [clients, selectedCities, selectedStates]);

  // Calcular rota otimizada (algoritmo simples de vizinho mais próximo)
  const route = useMemo(() => {
    if (!routeMode || filteredClients.length === 0) return [];

    const visited = new Set<string>();
    const result: Client[] = [];
    let current = filteredClients[0];
    result.push(current);
    visited.add(current.id);

    while (visited.size < filteredClients.length) {
      let nearest: Client | null = null;
      let minDist = Infinity;

      for (const client of filteredClients) {
        if (!visited.has(client.id) && client.lat && client.lng) {
          const dist = getDistance(current.lat, current.lng, client.lat, client.lng);
          if (dist < minDist) {
            minDist = dist;
            nearest = client;
          }
        }
      }

      if (!nearest) break;
      current = nearest;
      result.push(current);
      visited.add(current.id);
    }

    return result;
  }, [filteredClients, routeMode]);

  // Inicializar mapa uma única vez
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = L.map(mapContainer.current).setView([-14.2, -51.9], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance.current);

    layerGroup.current = L.layerGroup().addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      layerGroup.current = null;
    };
  }, []);

  // Atualizar marcadores quando dados mudam
  useEffect(() => {
    if (!mapInstance.current || !layerGroup.current) return;

    // Limpar camadas anteriores
    layerGroup.current.clearLayers();
    if (polyline.current) {
      polyline.current.removeFrom(mapInstance.current);
      polyline.current = null;
    }

    const bounds: L.LatLngTuple[] = [];

    filteredClients.forEach((client) => {
      if (!client.lat || !client.lng) return;

      bounds.push([client.lat, client.lng]);

      const tons = aggregates.get(client.id) ?? 0;
      const isInRoute = routeMode && route.some((r) => r.id === client.id);
      const routeIndex = isInRoute ? route.findIndex((r) => r.id === client.id) : -1;

      const marker = L.marker([client.lat, client.lng], {
        icon: L.divIcon({
          className: "",
          html: `
            <div class="cm-wrap ${isInRoute ? "cm-route" : ""}">
              ${routeIndex >= 0 ? `<span class="cm-num">${routeIndex + 1}</span>` : ""}
              <div class="cm-dot"></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        }),
      });

      marker.bindPopup(`
        <div style="min-width:180px;padding:6px">
          <strong>${client.name}</strong><br/>
          <span style="color:#666;font-size:12px">${client.farm || "—"}</span><br/>
          <span style="font-size:12px">📦 ${tons.toLocaleString("pt-BR")} t</span><br/>
          <span style="font-size:12px">📞 ${client.phone || client.whatsapp || "—"}</span>
        </div>
      `);

      layerGroup.current!.addLayer(marker);
    });

    // Desenhar rota
    if (routeMode && route.length > 1) {
      const coords = route
        .filter((c) => c.lat && c.lng)
        .map((c) => [c.lat, c.lng] as L.LatLngTuple);

      if (coords.length > 1) {
        polyline.current = L.polyline(coords, {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.7,
          dashArray: "6, 6",
        }).addTo(mapInstance.current);
      }
    }

    // Ajustar zoom
    if (bounds.length > 0) {
      mapInstance.current.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    }
  }, [filteredClients, routeMode, route, aggregates]);

  return (
    <Card className="overflow-hidden">
      <div ref={mapContainer} className="h-[500px] w-full" style={{ backgroundColor: "#e5e7eb" }} />
      <style>{`
        .cm-wrap {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .cm-dot {
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: linear-gradient(135deg, #10b981, #059669);
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }
        .cm-route .cm-dot {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }
        .cm-num {
          position: absolute;
          top: 0;
          right: 0;
          width: 18px;
          height: 18px;
          background: #ef4444;
          color: white;
          border: 2px solid white;
          border-radius: 50%;
          font-size: 10px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          z-index: 10;
        }
      `}</style>
    </Card>
  );
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
