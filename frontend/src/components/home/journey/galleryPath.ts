/** Artwork, not claims about which models are enabled at this installation. */
/**
 * The first plate is a gatefold, the second an upright folio, the third a
 * panorama, and the fourth a long canopy over the following chapter. Crop
 * anchors are in texture coordinates; width is in shared gallery world units.
 */
export const galleryWorks = [
  { name:'Claude', code:'MESSAGES', image:'corona', number:'01', format:'gatefold',
    aspect:1.72, width:8.08, crop:[.51,.54], tint:[.76,.51,.36] },
  { name:'GPT', code:'CHAT COMPLETIONS', image:'strata', number:'02', format:'folio',
    aspect:.99, width:4.86, crop:[.56,.50], tint:[.59,.67,.65] },
  { name:'Gemini', code:'GENERATE CONTENT', image:'interference', number:'03', format:'panorama',
    aspect:2.08, width:7.58, crop:[.57,.48], tint:[.69,.68,.73] },
  { name:'Antigravity', code:'DEDICATED ROUTE', image:'suspension', number:'04', format:'canopy',
    aspect:1.89, width:6.55, crop:[.52,.54], tint:[.76,.62,.48] },
] as const

export const editionFocus = [.347,.445,.50,.55] as const
export function editionIndex(progress:number) {
  let index=0
  for(let i=1;i<editionFocus.length;i++)
    if(Math.abs(progress-editionFocus[i])<Math.abs(progress-editionFocus[index])) index=i
  return index
}

const cl = (n:number) => Math.max(0,Math.min(1,n))
export function blend(a:number,b:number,p:number) {
  const t=cl((p-a)/(b-a)); return t*t*(3-2*t)
}
/** One angular track for all panes and both renderers. Scalar in radians;
 * each reversible pose is sampled from native scroll, not a carousel timer. */
export function galleryAngle(p:number,i:number) {
  // Equal angular spacing, independent of the editorial time spent on an
  // edition. The named plaza anchor (.445) holds the whole portrait folio.
  const stops=editionFocus
  let position:number
  if(p<=stops[0])position=(p-stops[0])/(stops[1]-stops[0])
  else if(p>=stops[3])position=3+(p-stops[3])/(stops[3]-stops[2])
  else {
    const j=p<stops[1]?0:p<stops[2]?1:2
    const gap=stops[j+1]-stops[j],t=(p-stops[j])/gap,t2=t*t,t3=t2*t
    const slope0=j===0?1/gap:2/(stops[j+1]-stops[j-1])
    const slope1=j===2?1/gap:2/(stops[j+2]-stops[j])
    position=j+3*t2-2*t3+gap*((t3-2*t2+t)*slope0+(t3-t2)*slope1)
  }
  return (i-position)*1.28
}
export function panelWindow(p:number,i:number) {
  const focus=editionFocus[i]
  return blend(focus-.116,focus-.076,p) * (1-blend(focus+.082,focus+.13,p))
}
