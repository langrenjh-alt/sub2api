/** The winding, bevels and thickness are real geometry; no glyph texture or
 * screen-space contour is used in either pass. Positions/normals are eye-space. */
export const vertex = /* glsl */ `
varying vec3 pos, normalEye;
void main() {
  pos = (modelViewMatrix * vec4(position, 1.)).xyz;
  normalEye = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * vec4(pos, 1.);
}`

export const back = /* glsl */ `
varying vec3 pos, normalEye;
void main() {
  // The fixed camera's useful depth range is 150..450 world units.
  gl_FragColor = vec4(normalize(normalEye) * .5 + .5, (-pos.z - 150.) / 300.);
}`

export const front = /* glsl */ `
varying vec3 pos, normalEye;
uniform sampler2D backSurface, worldPlate;
uniform vec2 bufferSize, plateScale, plateOrigin, stageScale, stageOffset;
uniform mat4 projection;
uniform float elapsed, orbit;
uniform vec2 aim;

vec2 projectPoint(vec3 p) {
  vec4 clip = projection * vec4(p, 1.);
  return clip.xy / clip.w * .5 + .5;
}
vec2 fieldUV(vec2 p) {
  return plateOrigin + (stageOffset + p * stageScale) * plateScale;
}
// An analytic HDR studio: broad cool wash, narrow key strip, secondary
// lilac/amber reflectors. Sampled in ray direction, never in screen space.
float sq(float a) { return a*a; }
vec3 studio(vec3 r) {
  r = normalize(r);
  float az = atan(r.x, r.z), el = asin(clamp(r.y, -.9999, .9999));
  vec3 sky = mix(vec3(.007,.012,.024), vec3(.13,.22,.32), smoothstep(-.7,1.,r.y));
  float overhead = exp(-sq((az+.85)/.50)-sq((el-.74)/.088));
  float key = exp(-sq((az+.37)/.48)-sq((el-.31+(az+.37)*.19)/.027));
  float pearl=exp(-sq((az+.37)/.28)-sq((el-.31+(az+.37)*.19)/.012));
  float strip = exp(-sq((az-1.10)/.065)-sq((el+.04)/.74));
  float violet = exp(-sq((az-1.68)/.48)-sq((el+.31)/.15));
  float amber = exp(-sq((az+1.65)/.19)-sq((el+.28)/.33));
  vec3 prismaticKey = mix(vec3(.33,3.4,6.2),vec3(3.9,6.4,1.1),smoothstep(-.53,-.24,az));
  prismaticKey=mix(prismaticKey,vec3(6.1,1.6,.50),orbit);
  return sky + pearl*vec3(4.0,4.4,4.1) + overhead*vec3(.8,1.9,2.2) + key*prismaticKey
    + strip*vec3(2.8,4.1,5.0) + violet*vec3(.88,.64,1.3) + amber*vec3(2.,1.15,.46);
}
float fresnel(float c, float n) {
  float f = (1.-n)/(1.+n);
  return f*f+(1.-f*f)*pow(1.-clamp(c,0.,1.),5.);
}
vec3 opticalRay(float ior, vec3 incident, vec3 n, vec4 backHere) {
  vec3 inside = refract(incident, n, 1./ior);
  float depth = backHere.a > .01 ? 150.+backHere.a*300. : -pos.z+14.;
  float chord = clamp((depth+pos.z)/max(.17,-inside.z),1.,34.);
  vec3 exitPos = pos + inside * chord;
  // Refine the actual exit point using the second depth lookup.
  vec2 exitUv = projectPoint(exitPos);
  vec4 b = texture2D(backSurface, clamp(exitUv, .001, .999));
  if (b.a < .01) b = backHere;
  vec3 exitN = b.a < .01 ? -n : normalize(b.rgb*2.-1.);
  if (dot(exitN, inside) < 0.) exitN = -exitN;
  if (b.a > .01) chord = clamp((150.+b.a*300.+pos.z)/max(.17,-inside.z),1.,36.);
  exitUv = projectPoint(pos + inside*chord);
  vec3 outgoing = refract(inside, -exitN, ior);
  vec3 reflectedInside = reflect(inside, -exitN);
  float exitF = fresnel(dot(exitN,inside),ior);
  if (length(outgoing)<.001) { outgoing=reflectedInside; exitF=1.; }
  vec2 bend = outgoing.xy/max(.26,-outgoing.z)-incident.xy/max(.26,-incident.z);
  // A distant environment bends more than objects touching the glass.
  vec2 sampleAt = fieldUV(exitUv) + bend * vec2(.22,.30);
  vec3 world = texture2D(worldPlate, clamp(sampleAt,.002,.998)).rgb;
  // A narrow emissive ribbon behind the field serves as a remote light source
  // for rays deflected far beyond the visible world plate.
  vec3 transmission = world * vec3(.94,1.07,1.13);
  transmission += .20*studio(outgoing) * smoothstep(.08,.85,length(bend));
  vec3 internal = studio(reflectedInside);
  // Beer-Lambert: longer rays acquire more teal at the edges.
  return mix(transmission, internal, exitF) * exp(-vec3(.010,.0035,.002)*chord);
}
void main() {
  vec3 n = normalize(normalEye);
  // Minute surface polish breaks up reflections, not the letter outline.
  float grain = fract(sin(dot(floor(pos.xy*5.),vec2(127.1,311.7)))*43758.5453)-.5;
  n=normalize(n+vec3(grain*.002,grain*.003,0.));
  vec3 incident = normalize(pos);
  vec2 uv = gl_FragCoord.xy / bufferSize;
  vec4 b = texture2D(backSurface, uv);
  vec3 refracted = vec3(opticalRay(1.515,incident,n,b).r,
                        opticalRay(1.535,incident,n,b).g,
                        opticalRay(1.557,incident,n,b).b);
  vec3 ref = reflect(incident, n);
  // Subtle slow movement of the lamp, independent of the camera.
  ref.xy += vec2(.08*cos(elapsed*.15)+aim.x*.045,.045*sin(elapsed*.18)+aim.y*.03);
  float fr = fresnel(dot(n,-incident),1.535);
  vec3 colour = mix(refracted,studio(ref),fr);
  // A long grazing kicker outlines only the curved bevel (not the planar face
  // or the broad walls). Its hue varies with the actual orientation of each facet.
  float grazing=exp(-sq((dot(n,-incident)-.78)/.105));
  float falloff=.24+.76*smoothstep(-.7,.8,dot(n,normalize(vec3(-.52,.73,.16))));
  vec3 edgeLight=mix(vec3(.05,.28,.52),vec3(.39,.85,.78),smoothstep(-.75,.8,n.y));
  edgeLight=mix(edgeLight,mix(vec3(.62,.14,.075),vec3(.80,.54,.24),smoothstep(-.5,.7,n.y)),orbit*.81);
  colour+=grazing*falloff*edgeLight;
  // Preserve direct visibility of live particles beneath the broad front faces;
  // traced transmission supplies the displaced view. Rim regions dominate optically.
  float face=smoothstep(.63,.98,dot(n,-incident));
  float alpha=mix(.96,.43,face);
  gl_FragColor=vec4(colour,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb *= alpha;
}`
