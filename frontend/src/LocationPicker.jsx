import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const pinIcon = L.divIcon({
  className: "fixmycity-map-pin",
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({ click(event) { onSelect(event.latlng.lat, event.latlng.lng); } });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 0.6 }); }, [center, map]);
  return null;
}

export default function LocationPicker({ position, onSelect, center }) {
  const initialCenter = center || position || [20.5937, 78.9629];
  return <MapContainer center={initialCenter} zoom={position ? 16 : 5} scrollWheelZoom className="location-map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapClickHandler onSelect={onSelect} />
    <Recenter center={center} />
    {position && <Marker position={position} icon={pinIcon} draggable eventHandlers={{ dragend: (event) => { const point = event.target.getLatLng(); onSelect(point.lat, point.lng); } }} />}
  </MapContainer>;
}
