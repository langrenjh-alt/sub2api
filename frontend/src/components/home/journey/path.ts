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
/** Analytic solution of a critically damped camera. dt is seconds, not frames.
 * Sampling an unchanged target at 30, 60 or 144 Hz gives the same trajectory. */
export function followFocus(value: number, velocity: number, target: number, dt: number, rate = 13) {
  const error = value - target
  const c = velocity + rate * error
  const f = Math.exp(-rate * dt)
  const next = target + (error + c * dt) * f
  const speed = (velocity - rate * c * dt) * f
  if (Math.abs(next - target) < .00012 && Math.abs(speed) < .002) return [target, 0] as const
  if (next < 0 || next > 1) return [clamp01(next), 0] as const
  return [next, speed] as const
}
