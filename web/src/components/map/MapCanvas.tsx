'use client';

import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect } from 'react';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export function mapsConfigured(): boolean {
  return MAPS_KEY.length > 0;
}

/** Recentres when the city changes, without fighting the user's own panning. */
function Recentre({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo({ lat, lng });
  }, [map, lat, lng]);
  return null;
}

/** Reports the centre back so "search this area" can refetch by proximity. */
function CentreReporter({ onIdle }: { onIdle: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const centre = map.getCenter();
      if (centre) onIdle(centre.lat(), centre.lng());
    });
    return () => listener.remove();
  }, [map, onIdle]);
  return null;
}

export default function MapCanvas({
  centre,
  pins,
  selectedId,
  onSelect,
  onCentreChange,
}: {
  centre: { lat: number; lng: number };
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCentreChange: (lat: number, lng: number) => void;
}) {
  // A missing key is a configuration gap, not an error state: the list beside
  // this panel still works, so say so plainly rather than rendering a grey box.
  if (!MAPS_KEY) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#EEF0EC] px-6">
        <p className="max-w-[320px] text-center text-sm leading-relaxed text-ink-3">
          지도를 불러올 수 없어요.
          <br />
          <span className="text-muted">
            Google Maps 키가 설정되지 않았어요. 왼쪽 목록은 그대로 쓸 수 있어요.
          </span>
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={MAPS_KEY} language="ko" region="CA">
      <Map
        // mapId is required for AdvancedMarker; 'DEMO_MAP_ID' is Google's own
        // default styling and needs no Cloud-console map style of its own.
        mapId="DEMO_MAP_ID"
        defaultCenter={centre}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="h-full min-h-[240px] w-full"
      >
        <Recentre lat={centre.lat} lng={centre.lng} />
        <CentreReporter onIdle={onCentreChange} />

        {pins.map((pin) => {
          const on = pin.id === selectedId;
          return (
            <AdvancedMarker
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              onClick={() => onSelect(pin.id)}
              title={pin.label}
              zIndex={on ? 2 : 1}
            >
              <span
                className="rounded-[14px] border-2 px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap shadow-md"
                style={{
                  borderColor: pin.color,
                  background: on ? pin.color : '#FFFFFF',
                  color: on ? '#FFFFFF' : pin.color,
                }}
              >
                {pin.label}
              </span>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}
