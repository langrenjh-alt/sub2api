import * as T from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

/** The original glyph outlines, including the actual counter of zero.
 * Coordinates are the source outlines transformed by the SVG's italic matrix. */
const outlines = [
  [[34,96],[94,96],[94,107],[54,146],[92,146],[85,159],[29,159],[29,148],[69,109],[34,109]],
  [[104,96],[148,96],[161,108],[161,121],[153,128],[161,135],[161,147],[148,159],[97,159],[104,146],[142,146],[147,141],[147,137],[141,132],[113,132],[120,120],[142,120],[147,116],[147,113],[142,109],[97,109]],
  [[182,96],[211,96],[225,110],[225,145],[211,159],[182,159],[167,145],[167,111]],
]
const counter=[[188,109],[181,116],[181,140],[188,146],[205,146],[211,140],[211,115],[205,109]]
const points=(poly:number[][])=>poly.map(([x,y])=>new T.Vector2(x-.1405*y+4.45,82-y))
export function wordGeometry() {
  const shapes=outlines.map(outline=>new T.Shape(points(outline)))
  shapes[2].holes.push(new T.Path(points(counter)))
  const raw=new T.ExtrudeGeometry(shapes,{
    depth:18.5,bevelThickness:2.2,bevelSize:1.28,bevelSegments:5,steps:1,
  })
  const vertices=raw.getAttribute('position')
  // A four-degree rear cut turns each letter into a very shallow prism.
  // Through it the actual field has a small, legible displacement; through the
  // zero it remains continuous with the background. The front is not frosted.
  const rearSlope=.067
  for(let i=0;i<vertices.count;i++){
    const z=vertices.getZ(i), rear=1-T.MathUtils.clamp(z/18.5,0,1)
    vertices.setZ(i,z+rearSlope*(vertices.getY(i)+45)*rear)
  }
  const geometry=toCreasedNormals(raw,.44)
  // Keep the large, optically clear caps genuinely planar. Do not average
  // their normals into the narrow bevel, which turns clear letters into chrome.
  const normals=geometry.getAttribute('normal'),pos=geometry.getAttribute('position')
  for(const g of geometry.groups)if(g.materialIndex===0)for(let i=g.start;i<g.start+g.count;i++)
    if(pos.getZ(i)>9)normals.setXYZ(i,0,0,1)
    else {const k=1/Math.sqrt(1+rearSlope*rearSlope);normals.setXYZ(i,0,rearSlope*k,-k)}
  geometry.center();geometry.computeBoundingBox()
  const width=geometry.boundingBox!.max.x-geometry.boundingBox!.min.x
  geometry.scale(1/width,1/width,1/width);geometry.computeBoundingBox()
  return geometry
}

type Section=readonly [number,number,number,number,number,number]
/** Centerline (x,y,z), half-width, half-depth, twist. These are independently
 * sculpted, closed volumes with an asymmetric edge, a broad polished face,
 * two chamfer cuts, and a moving frame along the spine. Units are world units. */
const sections:readonly (readonly Section[])[] = [
  [
    [-10.4,-3.45,10.7,.29,.26,-.46],[-8.3,-1.15,10.35,1.31,.76,-.15],
    [-6.25,.51,10.05,1.78,1.1,.19],[-4.38,1.98,9.75,2.02,1.17,.53],
    [-2.52,3.44,9.47,1.65,.91,.87],[-.55,4.80,9.04,1.17,.66,1.06],[1.42,6.07,8.50,.26,.16,1.00],
  ],
  [
    [-5.85,-5.42,10.78,.25,.20,-.48], [-2.83,-4.72,10.62,.82,.51,-.19],
    [-.15,-4.10,10.45,1.19,.70,.05],[2.16,-3.31,10.21,1.53,.88,.28],
    [3.96,-2.15,9.89,1.80,1.08,.54], [5.39,-.43,9.52,1.94,1.13,.86],
    [6.34,1.80,9.14,1.52,.93,1.18],[6.38,3.97,8.99,1.36,.75,1.44],[6.70,6.48,8.63,.48,.27,1.60],
  ],
  [
    [-9.1,-7.25,3.36,.20,.13,.05],[-5.3,-5.86,3.52,.76,.52,.15],
    [-1.45,-4.90,3.21,1.17,.76,.32],[1.81,-3.86,3.45,1.51,.92,.54],
    [4.58,-2.55,3.91,1.77,.98,.76],[6.82,-.72,3.71,2.07,1.08,1.04],
    [8.49,1.82,3.34,1.69,.91,1.25],[9.20,4.72,3.18,1.14,.65,1.41],[9.79,7.67,3.03,.35,.23,1.51],
  ],
]
export const openingWingCount=sections.length
export function wingGeometry(i:number){
  const rings=sections[i]
  const pts=rings.map(s=>new T.Vector3(s[0],s[1],s[2]))
  const spine=new T.CatmullRomCurve3(pts)
  // The asymmetry prevents each long facet from being a mirrored tube.
  const profile=[[-1,-.06],[-.87,.49],[-.54,.90],[.37,1.0],[.86,.50],[1,-.05],[.66,-.65],[-.18,-.87],[-.82,-.58]]
  // Grind a narrow curved fillet between the main optical faces. Long faces
  // and short polished shoulders therefore sample a range of studio angles,
  // rather than switching directly between nine hard polygon normals.
  const cuts:number[][]=[]
  for(let j=0;j<profile.length;j++){
    const a=profile[(j+profile.length-1)%profile.length],b=profile[j],c=profile[(j+1)%profile.length]
    const amount=j===0 || j===5 ? .075 : .19
    for(let run=0;run<=3;run++){
      const t=run/3
      cuts.push([0,1].map(k=>{
        const entry=b[k]+(a[k]-b[k])*amount,exit=b[k]+(c[k]-b[k])*amount
        return (1-t)*(1-t)*entry+2*(1-t)*t*b[k]+t*t*exit
      }))
    }
  }
  const rows=(rings.length-1)*12,cols=cuts.length
  const grid:T.Vector3[][]=[]
  for(let r=0;r<=rows;r++){
    const t=r/rows, j=Math.min(rings.length-2,Math.floor(t*(rings.length-1))), u=t*(rings.length-1)-j
    const interp=(k:number)=>{
      const p0=rings[Math.max(0,j-1)][k],p1=rings[j][k],p2=rings[j+1][k],p3=rings[Math.min(rings.length-1,j+2)][k]
      return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)
    }
    const at=spine.getPoint(t),tangent=spine.getTangent(t)
    const across=new T.Vector3().crossVectors(tangent,new T.Vector3(0,0,1)).normalize()
    const thru=new T.Vector3().crossVectors(across,tangent).normalize()
    const a=interp(5),x=new T.Vector3().copy(across).multiplyScalar(Math.cos(a)).addScaledVector(thru,Math.sin(a))
    const z=new T.Vector3().copy(thru).multiplyScalar(Math.cos(a)).addScaledVector(across,-Math.sin(a))
    grid.push(cuts.map(([bx,bz])=>at.clone().addScaledVector(x,bx*interp(3)).addScaledVector(z,bz*interp(4))))
  }
  const positions:number[]=[],normals:number[]=[]
  // Smooth lengthwise as in polished mineral sheets; keep the distinct
  // cross-section cuts sharp instead of averaging through a broad facet.
  const smoothGrid=grid.map((ring,r)=>ring.map((at,j)=>{
    const side=new T.Vector3().subVectors(at,ring[(j+cols-1)%cols]).normalize()
      .add(new T.Vector3().subVectors(ring[(j+1)%cols],at).normalize()).normalize()
    const along=new T.Vector3().subVectors(grid[Math.min(rows,r+1)][j],grid[Math.max(0,r-1)][j]).normalize()
    return side.cross(along).normalize()
  }))
  for(let j=0;j<cols;j++){
    const k=(j+1)%cols
    for(let r=0;r<rows;r++)for(const [row,col] of [[r,j],[r+1,k],[r+1,j],[r,j],[r,k],[r+1,k]]){
      positions.push(...grid[row][col].toArray());normals.push(...smoothGrid[row][col].toArray())
    }
  }
  for(const r of [0,rows]){
    const center=spine.getPoint(r/rows),n=spine.getTangent(r/rows).multiplyScalar(r===0?-1:1)
    for(let j=0;j<cols;j++){
      const k=(j+1)%cols
      for(const p of [center,grid[r][r===0?k:j],grid[r][r===0?j:k]]){positions.push(...p.toArray());normals.push(...n.toArray())}
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3))
  g.computeBoundingBox();g.computeBoundingSphere()
  return g
}
