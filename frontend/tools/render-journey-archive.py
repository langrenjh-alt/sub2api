"""Bake the four original model archive plates. Requires numpy and Pillow (not at runtime)."""
from pathlib import Path
import numpy as np
from PIL import Image

def unit(v): return v/np.maximum(1e-8,np.linalg.norm(v,axis=-1,keepdims=True))
def mix(a,b,t): return a*(1-t)+b*t

def render(kind):
    W,H=688,484
    y,x=np.mgrid[-1:1:H*1j,-W/H:W/H:W*1j].astype('float32')
    ray=unit(np.stack([x*.61,-y*.61,np.full_like(x,-1.70)],-1))
    eye=np.array([.03,.13,3.9],dtype='float32')
    # Each specimen is a distinct signed-distance sculpture with its own palette.
    def surface(p):
        xx,yy,zz=p[...,0],p[...,1],p[...,2]
        rot=[.57,-.27,-.44,.32][kind]
        X=np.cos(rot)*xx-np.sin(rot)*yy
        Y=np.sin(rot)*xx+np.cos(rot)*yy
        if kind==0:
            # Folded, finely fluted solar torus.
            Z=.83*zz+.56*Y; Y=.83*Y-.56*zz
            angle=np.arctan2(Y,X)
            rad=np.hypot(X,Y)-.84-.18*np.sin(3*angle+.3)
            return (np.hypot(rad*1.1,Z-.23*np.cos(3*angle)) - .31
                    + .016*np.sin(angle*86+Z*19))
        if kind==1:
            # A stack of offset lens blanks, ground at alternating angles.
            d=10.
            for i in range(-2,3):
                a=i*.23+.12; X1=np.cos(a)*X+np.sin(a)*zz; Z1=-np.sin(a)*X+np.cos(a)*zz
                h=Y-i*.31
                radius=np.maximum(np.abs(X1)*.89+np.abs(Z1)*.48,np.abs(Z1))
                d=np.minimum(d,np.maximum(radius-(.96-.09*abs(i)),np.abs(h)-.09)-.05)
            return d
        if kind==3:
            # Anti-gravity study: separated cut beryl slabs, suspended inside
            # two gimbal arcs. The final plane carries this image into the relay.
            u=.90*X+.44*zz; v=-.44*X+.90*zz
            h=.94*Y+.34*v; z=.94*v-.34*Y
            stone=(abs(u)*1.01+abs(z)*1.13+abs(h)*.58-.85)*.56-.023
            cuts=abs((h+.145)%.29-.145)-.107
            stone=np.maximum(stone,cuts)
            hoops=np.minimum(np.hypot(np.hypot(u,h*1.06)-.92,z)-.041,
                             np.hypot(np.hypot(z,h*1.02)-1.07,u+.095)-.026)
            return np.minimum(stone,hoops)
        # Chromatic split rings traversing a common axis.
        d=10.
        for i in range(-2,3):
            a=i*.48+.74; u=np.cos(a)*X+np.sin(a)*zz; w=-np.sin(a)*X+np.cos(a)*zz
            hoop=np.hypot(np.hypot(u,Y-i*.13)-(.84-.05*abs(i)),w-i*.13)-.088
            d=np.minimum(d,hoop)
        return d
    t=np.zeros_like(y);active=np.ones_like(y,dtype=bool)
    for _ in range(92):
        dist=surface(eye+ray*t[...,None])
        active&=(dist>.0018)&(t<7)
        if not active.any():break
        t+=np.where(active,np.maximum(.001,dist*.66),0)
    p=eye+ray*t[...,None];mask=(t<7)&(surface(p)<.008)
    n=unit(np.stack([surface(p+v)-surface(p-v) for v in np.eye(3,dtype='float32')*.0012],axis=-1))
    ref=unit(ray-2*np.sum(n*ray,axis=-1,keepdims=True)*n)
    palettes=np.array([[[.027,.006,.018],[.98,.19,.07],[1.,.77,.31]],
                       [[.002,.032,.034],[.06,.61,.54],[.64,.99,.69]],
                       [[.025,.008,.048],[.65,.18,.94],[.23,.85,.99]],
                       [[.019,.017,.023],[.66,.39,.16],[.62,.94,.86]]],dtype='float32')
    dark,mid,key=palettes[kind]
    diffuse=np.maximum(0,np.sum(n*np.array([-.46,.75,.46]),axis=-1))
    rim=(1-np.clip(np.sum(n*(-ray),axis=-1),0,1))**2
    stripe=np.exp(-((ref[...,1]-.41-ref[...,0]*.28)/.17)**2)
    stripe2=np.exp(-((ref[...,0]+.57)/.08)**2)
    wave=.5+.5*np.sin(ref[...,1]*17+ref[...,0]*5)
    colour=(dark[None,None,:]*.7+mid[None,None,:]*(diffuse*.4+.064)[...,None]
            + key[None,None,:]*(stripe*.86+stripe2*.76+rim*.25)[...,None]
            + mid[None,None,:]*(wave**7*.18)[...,None])
    glow=np.exp(-((x-.12)**2/.86+(y+.08)**2*.91));bg=dark+(mid*.12)[None,None,:]*glow[...,None]
    rng=np.random.default_rng(300+kind)
    bg+=rng.normal(0,.0028,bg.shape)
    rgb=np.where(mask[...,None],colour,bg)
    rgb+=rng.normal(0,.002,rgb.shape)
    rgb=np.clip(np.maximum(0,rgb)**(1/1.85),0,1)
    dest=Path(__file__).resolve().parents[1]/'public/assets/home'
    name=['corona','strata','interference','suspension'][kind]
    target=dest/f'z30-archive-{name}.webp';Image.fromarray((rgb*255).astype(np.uint8)).save(target,quality=87,method=6)
    print(name,target.stat().st_size)
if __name__=='__main__':
    for k in range(4): render(k)
