/** All coordinates are fractions of the native scroll runway, not wheel deltas. */
export const flightStops = [
  { id: 'origin', point: 0, label: 'home.flight.origin' },
  { id: 'plaza', point: 0.445, label: 'home.flight.gallery' },
  { id: 'connect', point: 0.66, label: 'home.flight.access' },
  { id: 'observatory', point: 0.94, label: 'home.flight.status' },
] as const

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export function flightProgress(top: number, height: number, viewport: number): number {
  return clamp01(-top / Math.max(height - viewport, 1))
}
export function phase(a: number, b: number, value: number): number {
  const t = clamp01((value - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export function currentFlightStop(p: number): number {
  return p < 0.32 ? 0 : p < 0.55 ? 1 : p < 0.78 ? 2 : 3
}
