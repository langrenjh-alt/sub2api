import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { wingGeometry, wordGeometry, openingWingCount } from '../journey/openingGeometry'
import { createLiveOpening } from '../journey/liveOpening'

describe('live opening volumes', () => {
  it('preserves cap thickness, correct winding, and the physical counter in zero', () => {
    const g=wordGeometry(),mesh=new T.Mesh(g,new T.MeshBasicMaterial())
    mesh.updateMatrixWorld(true)
    const ray=(x:number)=>new T.Raycaster(new T.Vector3(x,0,1),new T.Vector3(0,0,-1)).intersectObject(mesh)
    const box=g.boundingBox!
    expect(box.max.x-box.min.x).toBeCloseTo(1,4)
    expect(box.max.z-box.min.z).toBeGreaterThan(.088)
    expect(ray(.365)).toHaveLength(0)
    expect(ray(.471).length).toBeGreaterThan(0)
    g.dispose();mesh.material.dispose()
  })

  it('provides three closed, outward-wound solids with distinct world depths',()=>{
    expect(openingWingCount).toBe(3)
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3()
    for(let i=0;i<openingWingCount;i++){
      const g=wingGeometry(i),pos=g.getAttribute('position'),normal=g.getAttribute('normal')
      let signedVolume=0,agree=0,triangles=0
      for(let j=0;j<pos.count;j+=3){
        a.fromBufferAttribute(pos,j);b.fromBufferAttribute(pos,j+1);c.fromBufferAttribute(pos,j+2)
        signedVolume+=a.dot(b.clone().cross(c))/6
        n.fromBufferAttribute(normal,j)
        if(b.sub(a).cross(c.sub(a)).dot(n)>0)agree++
        triangles++
      }
      expect(signedVolume).toBeGreaterThan(0)
      expect(agree/triangles).toBeGreaterThan(.98)
      if(i<2)expect(g.boundingBox!.max.z).toBeGreaterThan(9)
      else expect(g.boundingBox!.max.z).toBeLessThan(7)
      g.dispose()
    }
  })

  it('keeps the inscription fixed in world space while the shared camera passes it',()=>{
    const scene=new T.Scene(),opening=createLiveOpening(scene),field=new T.DataTexture()
    const camera=new T.PerspectiveCamera(53,1.65,.15,87)
    camera.position.set(0,.2,18);camera.lookAt(0,.2,4)
    opening.setField(field,new T.Vector2(1280,800));opening.update(camera,0,0,false)
    const mark=scene.getObjectByName('Z30 / extruded glass')!
    const scale=mark.scale.x,orientation=mark.quaternion.clone()
    expect(scale).toBeGreaterThan(4);expect(mark.visible).toBe(true)
    camera.position.set(-3.25,.2,4);camera.lookAt(0,.1,-10);opening.update(camera,.17,1.5,false)
    expect(mark.position.toArray()).toEqual([0,.2,7.1])
    expect(orientation.angleTo(mark.quaternion)).toBeLessThan(1e-7)
    expect(mark.scale.x).toBe(scale)
    expect(mark.visible).toBe(false)
    opening.dispose();expect(scene.children).toHaveLength(0);field.dispose()
  })
})
