/** Two-surface screen-space transmission. Front/back samples are actual meshes
 * viewed by the current journey camera; there is no image plate or 2-D logo. */
export const crystalVertex = /* glsl */ `
varying vec3 eye,N,L;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.);
  eye=mv.xyz;N=normalize(normalMatrix*normal);L=position;
  gl_Position=projectionMatrix*mv;
}`

export const crystalExit = /* glsl */ `
varying vec3 eye,N,L;
void main(){
  // Float render targets preserve the smoothly varying exit normal in XYZ;
  // no octahedral hemisphere seam or discontinuous packed-normal interpolation.
  gl_FragColor=vec4(normalize(N)*.5+.5,clamp(-eye.z/40.,0.,1.));
}`

export const crystalFront = /* glsl */ `
varying vec3 eye,N,L;
uniform sampler2D field,backDepth;
uniform mat4 projection;
uniform float clock,word,ior,dispersion;
uniform vec2 resolution;
uniform vec4 exitWindow;
float sq(float x){return x*x;}
vec2 project(vec3 v){vec4 p=projection*vec4(v,1.);return p.xy/max(.0001,p.w)*.5+.5;}
float depth(vec4 data){return data.a*40.;}
vec3 exitVector(vec4 data){return normalize(data.rgb*2.-1.);}
float fresnel(float cosI,float ior){
  float f=(ior-1.)/(ior+1.);return f*f+(1.-f*f)*pow(1.-clamp(cosI,0.,1.),5.);
}
// Long, sharply cut studio sources. A charcoal room is punctuated by opaline
// overhead strips and a copper bounce; no diffuse coat is applied to the glass.
vec3 environment(vec3 ray) {
  vec3 w=normalize(vec3(dot(ray,viewMatrix[0].xyz),dot(ray,viewMatrix[1].xyz),dot(ray,viewMatrix[2].xyz)));
  float a=atan(w.x,w.z),h=asin(clamp(w.y,-.999,.999));
  float drift=.052*sin(clock*.155);
  float broad=exp(-sq((h-.49-.34*sin(a+.2)+drift)/.32))*(.62+.38*cos(a+.86));
  float silk=exp(-sq((h-.71-.38*sin(a+.22))/.20))*(.72+.28*cos(a+.64));
  float line=exp(-sq((h-.50-.34*sin(a+.2)+drift)/.045))*exp(-sq((a+.52)/1.45));
  float upright=exp(-sq((a-1.14-.29*h)/.132)-sq((h-.19)/1.28));
  float copper=exp(-sq((h+.31-.45*sin(a-.78))/.19))*(.68+.32*cos(a+1.33));
  float gold=exp(-sq((h+.31-.45*sin(a-.78))/.035))*exp(-sq((a+1.22)/1.52));
  float ribbon=exp(-sq((h+.06+.55*sin(a+.41))/.031)-sq((a-2.15)/1.35));
  return mix(vec3(.018,.023,.031),vec3(.21,.25,.28),smoothstep(-.72,1.,w.y))
     +broad*vec3(.81,.97,1.10)+silk*vec3(.65,.77,.84)+line*vec3(5.5,6.0,6.55)
     +upright*vec3(2.9,3.40,3.82)+copper*vec3(2.70,1.55,.77)+gold*vec3(5.2,3.76,1.90)
     +ribbon*vec3(3.90,4.15,4.25);
}
vec3 fieldAt(vec3 start,vec3 ray,float farDepth){
  float dz=max(.1,farDepth+start.z);
  vec2 st=project(start + ray*dz/max(.035,-ray.z));
  vec2 border=min(st,1.-st);
  float onscreen=smoothstep(-.12,.015,min(border.x,border.y))*(1.-smoothstep(-.18,-.025,ray.z));
  vec3 fieldPixel=texture2D(field,clamp(st,.001,.999)).rgb;
  return mix(environment(ray),fieldPixel,onscreen);
}

void main(){
  // Fine optical figuring changes transmission rather than painting stripes
  // on the surface. Its amplitude is small enough to leave the logo caps flat.
  vec3 figuring=.012*vec3(sin(.91*L.x+1.6*L.y-.37*L.z),cos(1.18*L.x+.49*L.y),sin(1.24*L.y))
    + .0018*vec3(cos(6.7*L.x+1.8*L.y),sin(7.2*L.y-.9*L.z),sin(4.6*L.x+7.9*L.y));
  vec3 normalFront=normalize(N+figuring*(1.-word));
  vec3 I=normalize(eye);
  vec2 st=gl_FragCoord.xy/resolution;
  vec4 straight=texture2D(backDepth,st);
  float n0=ior;
  vec3 inside=refract(I,normalFront,1./n0);
  float z0=depth(straight),nearDepth=-eye.z;
  float maxChord=mix(4.4,.82,word);
  float chord=z0>nearDepth+.001?clamp((z0-nearDepth)/max(.10,-inside.z),.005,maxChord):mix(.28,.075,word);
  vec3 exitNormal=z0>nearDepth+.001?exitVector(straight):-normalFront;
  // Reproject to the *real exit surface* along the interior path. At a side
  // silhouette miss, shorten the segment toward the last valid back sample.
  for(int j=0;j<3;j++){
    vec2 lookup=project(eye+inside*chord);
    vec4 sampleB=texture2D(backDepth,clamp(lookup,.0005,.9995));
    // A reprojected interior ray can leave this frame's scissored exit box.
    // Never read a previous pose from the unused region of the target.
    sampleB.a*=step(exitWindow.x,lookup.x)*step(exitWindow.y,lookup.y)
      *step(lookup.x,exitWindow.z)*step(lookup.y,exitWindow.w);
    float zb=depth(sampleB);
    if(zb>nearDepth+.001){chord=mix(chord,clamp((zb-nearDepth)/max(.10,-inside.z),.001,maxChord),.8);exitNormal=exitVector(sampleB);}
    else chord*=.61;
  }
  if(dot(exitNormal,inside)<0.)exitNormal=-exitNormal;
  float farDepth=nearDepth+mix(12.,8.,word);
  vec3 sampleColour=vec3(0.);
  // Dispersion is measured in IOR, not a colour fringe painted at the edge.
  for(int c=0;c<3;c++){
    float spectralIor=n0+(float(c)-1.)*dispersion;
    vec3 R=refract(I,normalFront,1./spectralIor);
    vec3 P=eye+R*chord;
    vec3 outgoing=refract(R,-exitNormal,spectralIor);
    vec3 bounce=normalize(reflect(R,-exitNormal));
    vec3 bounced=fieldAt(P,bounce,farDepth);
    float cosExit=clamp(dot(exitNormal,R),0.,1.);
    float sinExit2=spectralIor*spectralIor*max(0.,1.-cosExit*cosExit);
    float exitF=fresnel(cosExit,spectralIor);
    // Integrate the narrow critical-angle transition over a pixel footprint;
    // the ray changes continuously instead of switching a colour channel on/off.
    float sw=max(.026,fwidth(sinExit2)*1.8);
    float tir=smoothstep(1.-sw,1.+sw,sinExit2);
    vec3 tx;
    vec3 tangent=normalize(R+exitNormal*.0001-exitNormal*dot(exitNormal,R));
    vec3 exitRay=length(outgoing)<.0001 ? tangent : normalize(outgoing);
    tx=mix(fieldAt(P,exitRay,farDepth),bounced,mix(exitF,1.,tir));
    tx*=exp(-mix(vec3(.136,.093,.061),vec3(.042,.021,.014),word)*chord);
    if(c==0)sampleColour.r=tx.r;else if(c==1)sampleColour.g=tx.g;else sampleColour.b=tx.b;
  }
  float nc=clamp(dot(-I,normalFront),0.,1.);
  float fr=fresnel(nc,n0);
  vec3 refl=environment(normalize(reflect(I,normalFront)));
  vec3 col=mix(sampleColour,refl,fr);
  float grazing=pow(1.-nc,3.);
  float polish=.5+.5*cos(dot(normalFront,normalize(vec3(.49,.73,-.38)))*8.4+.06*clock);
  col+=grazing*polish*vec3(.014,.028,.043);
  // The framebuffer already contains the scene in display space. Keep the
  // transmitted radiance intact; compress only overbright studio reflections.
  col=min(col,vec3(.77)) + max(col-.77,0.)/(1.+max(col-.77,0.)*4.35);
  gl_FragColor=vec4(col,1.);
}`
