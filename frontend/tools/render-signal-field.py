# /// script
# requires-python = '>=3.11'
# dependencies = ['numpy==2.4.6', 'pillow==13.0.0']
# ///
"""Bake the original Z30 optical field. Run: uv run frontend/tools/render-signal-field.py

A small software renderer: camera-space splines, dielectric tubes, a particulate
stream, and depth of field. No viewport-sized textures are generated at runtime.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H = 1920, 1080
rng = np.random.default_rng(30037)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
x, y = xx / W, yy / H


def halo(cx, cy, sx, sy):
    return np.exp(-((x-cx)/sx)**2 - ((y-cy)/sy)**2)


def cloud():
    out = np.zeros((H, W), np.float32)
    for scale, gain in ((6, .56), (19, .26), (71, .12), (213, .06)):
        raw = rng.integers(0, 255, (scale, round(scale * W/H)), np.uint8)
        out += gain * (np.asarray(Image.fromarray(raw).resize((W,H), Image.Resampling.BICUBIC))/255 - .5)
    return out


atmosphere = cloud()
rgb = np.broadcast_to(np.array([6., 8., 15.]), (H,W,3)).copy()
for glow, tint in (
    (halo(-.10,.20,.20,.68), [17,25,28]),
    (halo(1.03,.33,.18,.78), [9,27,24]),
    (halo(.19,.44,.49,.8), [4,5,12]),
    (halo(.84,.44,.27,.55), [7,8,13]),
    (halo(.62,.79,.29,.18), [5,16,16]),
    (halo(.13,.92,.20,.36), [5,13,22]),
):
    rgb += (glow*(1+atmosphere*1.4))[:,:,None]*np.array(tint)
rgb += rng.normal(0, .68, (H,W,1))
scene = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))

# Back-to-front strata of particulate matter. A few large defocused particles
# contrast with the dust in the waist of the current; no uniform star field.
particle_colours = np.array([[102,145,237], [93,153,186], [142,207,183], [210,222,180], [164,161,216]])
for layer, count, blur in [(0, 7500, 1.8), (1, 9600, .16), (2, 410, 1.2)]:
    plane = Image.new('RGB', (W,H))
    pen = ImageDraw.Draw(plane)
    for n in range(count):
        stream = rng.random()
        t = rng.uniform(-.1, 1.1)
        phi = rng.uniform(0, 2*np.pi)
        thickness = rng.normal(0, 1)
        depth = np.cos(phi + t*9)
        if stream < .58:
            # The first stream enters low in the foreground and disappears into
            # a compact, distant knot above the right-hand horizon.
            px = .19 + .64*t
            py = 1.17 - .49*t + .09*np.sin(t*6.1) + .105*np.sin(phi + t*8)*(1.22-t)
            py += thickness*(.025 + .035*(1-t))
            colour = 2 + int(rng.random()>.68)
        elif stream < .85:
            px = .405 - .136*np.sin(t*3.3) + .055*np.sin(phi+t*10)*(t+.3)
            py = -.08 + t*1.24 + thickness*.015
            px += thickness*(.008 + .038*t)
            colour = int(rng.random()>.68)
        else:
            px = .37 + .55*t + thickness*.020
            py = 1.10 - .24*np.sin(t*5) + .055*np.sin(phi+t*9) + thickness*.026
            colour = rng.choice([0,1,4])
        if stream >= .58 and py < .52 and rng.random() > max(.03, py*py):
            continue
        if not (-.03<px<1.03 and -.03<py<1.03):
            continue
        light = rng.lognormal(-.96,.88) * [.32,.87,.53][layer] * (.78+.20*depth)
        col = particle_colours[colour]
        r = rng.lognormal(-.73,.82) if layer<2 else rng.uniform(1.1,8.0)
        r *= (1.18-.28*depth)
        i,j=px*W,py*H
        if r>=2:
            # Grazing glint on each of the out-of-focus glass grains.
            pen.ellipse((i-r,j-r,i+r,j+r),fill=tuple(np.uint8(np.clip(col*light*.38,0,255))))
            pen.ellipse((i-r*.83,j-r*.82,i+r*.38,j+r*.47),fill=tuple(np.uint8(np.clip(col*light*.68,0,255))))
            pen.ellipse((i-r*.72,j-r*.79,i-r*.07,j-r*.22),fill=tuple(np.uint8(np.clip(col*light,0,255))))
        else:
            pen.ellipse((i-r,j-r,i+r,j+r),fill=tuple(np.uint8(np.clip(col*light,0,255))))
    plane = plane.filter(ImageFilter.GaussianBlur(blur))
    scene = ImageChops.add(scene, plane)


def unit(v):
    return v / np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-8)


def spline(points):
    """Screen composition keys specify real XYZ positions relative to a 5-unit lens."""
    keys = np.array(points)
    z = keys[:,2]
    pts = np.column_stack(((keys[:,0]-.5)*W/H*z, (.5-keys[:,1])*z, z))
    pts = np.concatenate(([pts[0]], pts, [pts[-1]]))
    curve=[]
    t = np.linspace(0,1,280,endpoint=False)[:,None]
    for a,b,c,d in zip(pts,pts[1:],pts[2:],pts[3:]):
        curve.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t**2+(-a+3*b-3*c+d)*t**3))
    return np.concatenate(curve)


def optical_tube(keys, radius, intensity, shift=0):
    """Trace the front of the circular cross-section over an HDR studio-light field."""
    path = spline(keys)
    tangent = unit(np.gradient(path,axis=0))
    view = unit(-path)
    side = unit(np.cross(tangent,view))
    face = unit(np.cross(side,tangent))
    u = np.linspace(-.999,.999,61)[None,:,None]
    nrm = side[:,None,:]*u + face[:,None,:]*np.sqrt(1-u*u)
    f = np.linspace(0, 1, len(path))
    # Gradually emerge from the far plane — a hairline, not a capped pipe.
    taper = np.minimum(1, f * 5.5)
    surface = path[:,None,:]+(radius*taper[:,None,None])*nrm
    pixel_x = (surface[:,:,0]/surface[:,:,2]*H + W*.5).round().astype(int)
    pixel_y = (-surface[:,:,1]/surface[:,:,2]*H + H*.5).round().astype(int)
    facing = np.sum(nrm*view[:,None,:],axis=2)
    refl = 2*facing[:,:,None]*nrm-view[:,None,:]
    fresnel = .045 + .955 * np.power(1-np.clip(facing,0,1),3.0)
    # A continuous grazing reflection and two narrow irregular softbox highlights.
    lum = np.zeros((*facing.shape, 3))
    lum += np.array([6,12,23]) + fresnel[:,:,None]*[24,42,61]
    for light, tint, width in (
        ((-.46,.76,-.44), [104,184,215], .105),
        ((.61,.22,-.75), [57,98,219], .18),
        ((.63,-.56,.49), [192,231,191], .12),
    ):
        dot = np.einsum('ijk,k->ij',refl,unit(np.array(light)))
        spec = np.exp(-np.maximum(1-dot,0)/(width*width))
        lum += spec[:,:,None]*np.array(tint)*(.47 + fresnel[:,:,None])
    chroma = .5+.5*np.sin(u[:,:,0]*10+f[:,None]*13+shift)
    lum += (chroma*fresnel*.64)[:,:,None]*[40,43,96]
    # Slightly uneven absorption through the glass, rather than a solid wire.
    lum *= intensity*(.62+.38*np.sin(f*3+shift)**2)[:,None,None]
    # Crossing caustics: chromatic bands appear only at a few oblique angles
    # where the grazing light enters the filament; the glass core stays dark.
    for centre, span, colour, edge in [
        (.33,.080,[115,226,195],-.80), (.49,.052,[143,182,248],.87),
        (.75,.07,[106,135,218],-.85), (.22,.02,[224,228,185],.48),
    ]:
        streak = np.exp(-((f[:,None]-centre)/span)**2) * np.exp(-((u[:,:,0]-edge)/.195)**2)
        lum += intensity * streak[:,:,None]*colour
    col = np.uint8(np.clip(lum,0,255))
    plane = Image.new('RGB',(W,H))
    alpha = Image.new('L',(W,H))
    ink = ImageDraw.Draw(plane)
    opacity = ImageDraw.Draw(alpha)
    # Subpixel wire cross-sections are foreshortened by depth. Use painter order.
    for j in np.argsort(path[:,2])[::-1]:
        for k in range(0,60,2):
            pt=(pixel_x[j,k],pixel_y[j,k],pixel_x[j,k+2],pixel_y[j,k+2])
            ink.line(pt,fill=tuple(col[j,k+1]),width=2)
            opacity.line(pt,fill=round(230 * min(1, f[j]*5)),width=2)
    softness = .65 if intensity<.5 else .35
    global scene
    scene = Image.composite(plane.filter(ImageFilter.GaussianBlur(softness)),scene,alpha.filter(ImageFilter.GaussianBlur(softness)))
    scene = ImageChops.add(scene,Image.composite(plane,Image.new("RGB",(W,H)),alpha).filter(ImageFilter.GaussianBlur(4)).point(lambda v: v*.45))


# Two unconnected ray paths cross only *below* the title. The negative space
# above the word remains unobstructed; neither strand encloses an emblem.
optical_tube([(.715,.59,7.2),(.674,.615,6.9),(.645,.667,6.2),(.581,.79,5.5),(.463,.91,4.4),(.356,1.135,3.45)], .014, 1.20, .24)
optical_tube([(.34,.645,7.3),(.365,.68,6.65),(.40,.747,6.0),(.471,.826,5.1),(.575,.945,4.35),(.636,1.11,3.2)], .017, .94, .73)

target = Path(__file__).resolve().parents[1]/'public/assets/home/z30-signal-field.webp'
scene.save(target, quality=91, method=6)
print(f'{target.name}: {target.stat().st_size:,} bytes')
