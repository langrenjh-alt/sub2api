import * as T from 'three'

/** Diegetic fiducials beyond Z30. A hairline and a handful of travelling
 * points are directly visible through the 0 counter, displaced through the
 * glass beside it, and present in every live opaque capture. No billboard. */
export function createOpeningStrands(group:T.Group){
  const clocks={value:0}
  const curves:T.CatmullRomCurve3[]=[]
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[]
  const dots:T.Mesh[]=[]
  const names=['Cold conductor','Return conductor','Copper conductor']
  const palettes=[[.70,.86,.92],[.40,.53,.62],[.80,.57,.36]]
  for(let k=0;k<3;k++){
    const knots:T.Vector3[]=[]
    for(let j=0;j<=38;j++){
      const x=-15+j*30/38
      const y=k===0?.17+.065*x+.18*Math.sin(.69*x+.36):
        k===1?.63+.060*x+.37*Math.sin(.54*x+.84):-.22+.21*Math.sin(.43*x-.27)-.041*x
      const z= k===0?3.72+.41*Math.sin(x*.39):k===1?2.14+.64*Math.sin(x*.32+1.):.56+.73*Math.cos(x*.31)
      knots.push(new T.Vector3(x,y,z))
    }
    const curve=new T.CatmullRomCurve3(knots);curves.push(curve)
    for(let j=0;j<2;j++){
      const radius=(j===0?.013:.043)*(k===1?.68:1)
      const geo=new T.TubeGeometry(curve,128,radius,6,false),rgb=palettes[k]
      const mat=new T.ShaderMaterial({
        name:'Z30FieldFilament', uniforms:{elapsed:clocks,ink:{value:new T.Vector3(rgb[0],rgb[1],rgb[2])},kind:{value:k},halo:{value:j}},
        vertexShader:`varying float arc;
        uniform float elapsed,kind;
        void main(){ vec3 p=position;arc=p.x;
          p.y+=.036*sin(p.x*.41+elapsed*.37+kind)+.019*cos(p.x*.62-elapsed*.28+kind);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
        fragmentShader:`varying float arc;uniform float elapsed,kind,halo;uniform vec3 ink;
        void main(){float a=.5+.5*cos(arc*.74-elapsed*.51+kind*1.7);
          float core=.25+.75*pow(a,4.);
          gl_FragColor=vec4(ink*core,halo<.5?.90:.085);
        }`,
        transparent:true,depthWrite:false,
      })
      const mesh=new T.Mesh(geo,mat);mesh.name=names[k];group.add(mesh)
      materials.push(mat);geometries.push(geo)
    }
  }
  const ball=new T.IcosahedronGeometry(1,1)
  const glint=new T.ShaderMaterial({name:'Z30SignalSeed',vertexShader:`varying vec3 n;
    void main(){n=normalMatrix*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 n;void main(){
      float key=pow(max(.0,dot(normalize(n),normalize(vec3(-.47,.62,.61)))),3.);
      gl_FragColor=vec4(vec3(.048,.073,.079)+vec3(.85,.94,1.)*key,1.);
    }`})
  geometries.push(ball);materials.push(glint)
  for(let i=0;i<17;i++){
    const m=new T.Mesh(ball,glint);m.scale.setScalar(i%4===0?.054:.026)
    dots.push(m);group.add(m)
  }
  return {
    update(t:number){clocks.value=t;dots.forEach((m,i)=>{
      const u=(.075+i*.0613+t*(.00165+i%3*.0012))%1
      curves[i%3].getPointAt(u,m.position)
      m.position.y+=.036*Math.sin(m.position.x*.41+t*.37+i%3)+.019*Math.cos(m.position.x*.62-t*.28+i%3)
    })},
    dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())},
  }
}
