/** Artwork, not claims about which models are enabled at this installation. */
export const galleryWorks = [
  { name:'Claude', code:'MESSAGES', image:'corona', number:'01', tint:[.94,.37,.17] },
  { name:'GPT', code:'CHAT COMPLETIONS', image:'strata', number:'02', tint:[.17,.83,.63] },
  { name:'Gemini', code:'GENERATE CONTENT', image:'interference', number:'03', tint:[.66,.30,.94] },
  { name:'Antigravity', code:'DEDICATED ROUTE', image:'suspension', number:'04', tint:[.94,.55,.28] },
] as const

const cl = (n:number) => Math.max(0,Math.min(1,n))
export function blend(a:number,b:number,p:number) {
  const t=cl((p-a)/(b-a)); return t*t*(3-2*t)
}
/** One angular track for all panes and both renderers. Scalar in radians;
 * each reversible pose is sampled from native scroll, not a carousel timer. */
export function galleryAngle(p:number,i:number) {
  const focus=[.347,.417,.485,.55]
  const t=focus[i]
  return ((t-p)/.067)*1.28
}
export function panelWindow(p:number,i:number) {
  const focus=[.347,.417,.485,.55][i]
  return blend(focus-.116,focus-.076,p) * (1-blend(focus+.082,focus+.13,p))
}
