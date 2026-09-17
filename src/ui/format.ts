/** Readout formatting for the HUD. Values are stylised and time-compressed. */

export function formatAltitude(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatSpeed(kmh: number) {
  return `${Math.round(kmh).toLocaleString('en-US')} km/h`;
}