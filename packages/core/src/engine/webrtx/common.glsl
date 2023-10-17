#ifndef _SHADOWRAY_PLAYGROUND_COMMON_
#define _SHADOWRAY_PLAYGROUND_COMMON_
// clang-format off

#ifndef _SHADOWRAY_STRUCT_
#define _SHADOWRAY_STRUCT_

struct BSDFSampleRecord {
  vec3 f;  // i.e. f*g/pA or f*cos/pW
  vec3 wiW;
  float pdf_w;
  uint sampled_type;
};

struct PointSampleRecord {
  vec3 p;
  vec3 n;  // geometric normal!!!
  // shape sample function will store pdf w.r.t area
  float pdf;  // will be eventually used as pdf w.r.t solid angle
};

struct LightSampleRecord {
  PointSampleRecord point_sample;
  vec3 radiance_estimate;  // = radiance*cos/pdf_w
  vec4 bsdf_evaluation;    // vec3(f), float(pdf)
};

struct RayPayload_PT_Radiance {
  uvec3 seed;
  bool done;  // e.g. ray miss
  // hitpoint information
  vec3 hitPoint;

  // sampling information for next ray, e.g. ray direction, evaluated BSDF value
  BSDFSampleRecord bsdfSampleRecord;
  // emitter current hitpoint
  vec4 emit_radiance;  // vec3(radiance), float(pdf_solid_angle)

  LightSampleRecord lightSampleRecord;

  vec3 alpha;  // throughput so far, products of sampled bsdf weight(f/pdf)
               // it's on emitter
};

#endif
#ifndef _SHADOWRAY_UTILS_
#define _SHADOWRAY_UTILS_

#define EPSILON 1e-4
#define M_PI_4f 0.785398163397448309616f
#define M_1_PIf 0.31830988618379067154f
#define M_PIf 3.14159265358979323846f
#define M_TWOPI 6.28318530718f
#define INV_PI M_1_PIf
#define INV_TWOPI 0.15915494309189533577f

struct Frame {
  vec3 u, v, w;  // tangent binormal normal;
};

Frame makeFrame(const vec3 normal) {
  Frame frame;
  frame.w = normal;

  if (abs(normal.x) > abs(normal.z)) {
    frame.v = vec3(-normal.y, normal.x, 0);
  } else {
    frame.v = vec3(0, -normal.z, normal.y);
  }

  frame.v = normalize(frame.v);
  frame.u = cross(frame.v, frame.w);
  return frame;
}

vec3 L2W(const Frame frame, const vec3 l) {
  return l.x * frame.u + l.y * frame.v + l.z * frame.w;
}

float zup_w2abscostheta(const vec3 w) { return abs(w.z); }

vec3 zup_spherical2cartesian(float sintheta, float costheta, float phi) {
  return vec3(sintheta * cos(phi), sintheta * sin(phi), costheta);
}

float cos2sin(float cosx) { return sqrt(1. - cosx * cosx); }

float sin2cos(float sinx) { return sqrt(1. - sinx * sinx); }

float pdfCosineHemisphere(const vec3 w, const vec3 n) {
  return abs(dot(w, n)) * M_1_PIf;
}

float pdfCosineHemisphere(const vec3 w)  // float costheta, float phi
{
  return zup_w2abscostheta(w) /*costheta*/ * M_1_PIf;
}

vec2 square_to_disk(float u1, float u2) {
  float phi, r;

  const float a = 2.0f * u1 - 1.0f;
  const float b = 2.0f * u2 - 1.0f;

  if (a > -b) {
    if (a > b) {
      r = a;
      phi = M_PI_4f * (b / a);
    } else {
      r = b;
      phi = M_PI_4f * (2.0f - (a / b));
    }
  } else {
    if (a < b) {
      r = -a;
      phi = M_PI_4f * (4.0f + (b / a));
    } else {
      r = -b;
      phi = (b != 0.0) ? M_PI_4f * (6.0f - (a / b)) : 0.0f;
    }
  }

  return vec2(r * cos(phi), r * sin(phi));
}

vec3 uniformHemisphere(float u1, float u2) {
  float r = sqrt(1. - u1 * u1);
  float phi = 2. * 3.141592 * u2;
  return vec3(r * cos(phi), r * sin(phi), u1);
}

float safe_sqrt(float x) { return sqrt(max(0, x)); }

vec3 cosineHemisphere(float u1, float u2, out float pdf) {
  vec2 ondisk = square_to_disk(u1, u2);
  vec3 w = vec3(ondisk, safe_sqrt(1.0 - dot(ondisk, ondisk)));
  pdf = pdfCosineHemisphere(w);
  return w;
}

vec3 expHemisphere(float u1, float u2, float cexp) {
  // phi=2pi*u1
  // cos_theta=(1-u2)^(1/(exp+1))
  cexp = mix(cexp, 2e10, (cexp > 990000.));
  float phi = u2 * M_TWOPI;
  float costheta = pow(u1, 1.f / (cexp + 1.f));
  return zup_spherical2cartesian(cos2sin(costheta), costheta, phi);
}

float pdfExpHemisphere(float costheta, float cexp) {
  return pow(costheta, cexp) * (cexp + 1.f) * INV_TWOPI;
}

float safe_rcp(float x) { return x == 0. ? 0. : 1. / x; }

float pdfArea2SolidAngle(float pdf_area, const vec3 p, const vec3 p_next,
                         const vec3 n_next) {
  vec3 w = p_next - p;
  float len2 = dot(w, w);
  w *= safe_rcp(sqrt(len2));
  return pdf_area * len2 * safe_rcp(abs(dot(n_next, w)));
}

// 0 pi
float yup_spherical_theta(const vec3 v) { return acos(clamp(-v.y, -1.f, 1.f)); }

// 0 2pi
float yup_spherical_phi(const vec3 v) {
  float p = atan(v.x, -v.z);  // mitsuba use -v.z???
  return (p < 0.f) ? p + M_TWOPI : p;
}

vec2 yup_spherical_uv(const vec3 w) {
  return vec2(INV_TWOPI * yup_spherical_phi(w),
              INV_PI * yup_spherical_theta(w));
}

// at distance 1
vec2 getImagePlaneSize(float vfov) {
  float y = 2.0 * tan(vfov);
  float aspect_ratio = gl_LaunchSizeEXT.x / gl_LaunchSizeEXT.y;
  return vec2(aspect_ratio * y, y);
}

void rotate_two_axis(inout mat4 m, uint axis1, uint axis2, float rad) {
  float c = cos(rad), s = sin(rad);
  vec3 new_axis1 = m[axis1].xyz * c + m[axis2].xyz * s;
  vec3 new_axis2 = m[axis2].xyz * c - m[axis1].xyz * s;
  m[axis1].xyz = new_axis1;
  m[axis2].xyz = new_axis2;
}

#endif

#ifndef _SHADOWRAY_BSDF_
#define _SHADOWRAY_BSDF_



const uint BSDF_REFLECTION = 1;
const uint BSDF_TRANSMISSION = (1 << 1);
const uint BSDF_DIFFUSE = (1 << 2);
const uint BSDF_GLOSSY = (1 << 3);
const uint BSDF_SPECULAR = (1 << 4);

const uint BSDF_DIFFUSE_REFLECT = (BSDF_DIFFUSE | BSDF_REFLECTION);
const uint BSDF_SPECULAR_REFLECT = (BSDF_SPECULAR | BSDF_REFLECTION);
const uint BSDF_SPECULAR_TRANSMIT = (BSDF_SPECULAR | BSDF_TRANSMISSION);
const uint BSDF_GLOSSY_REFLECT = (BSDF_GLOSSY | BSDF_REFLECTION);
const uint BSDF_GLOSSY_TRANSMIT = (BSDF_GLOSSY | BSDF_TRANSMISSION);
const uint BSDF_ALL_TYPES = (BSDF_DIFFUSE | BSDF_SPECULAR | BSDF_GLOSSY);
const uint BSDF_ALL_REFLECTION = (BSDF_REFLECTION | BSDF_ALL_TYPES);
const uint BSDF_ALL_TRANSMISSION = (BSDF_TRANSMISSION | BSDF_ALL_TYPES);
const uint BSDF_ALL = (BSDF_ALL_REFLECTION | BSDF_ALL_TRANSMISSION);
const uint BSDF_NO_SPECULAR = (BSDF_ALL & ~BSDF_SPECULAR);

#define IS_TYPE_SPECULAR(t) (((t)&BSDF_SPECULAR) != 0)
#define IS_TYPE_DIFFUSE(t) (((t)&BSDF_DIFFUSE) != 0)
#define IS_TYPE_GLOSSY(t) (((t)&BSDF_GLOSSY) != 0)

#define ABOVE_SURFACE(w, Ns) (dot((w), (Ns)) > 0.)
#define BELOW_SURFACE(w, Ns) (dot((w), (Ns)) <= 0.)
#define STEP_IF_ABOVE_SURFACE(w, Ns) step(0., dot((w), (Ns)))

vec4 doBsdfEval(vec4 lemit_invarea, vec3 hitPoint, vec3 rayOrigin,
                vec3 rayDirection, const vec3 Ns) {
  const vec3 woW = -rayDirection;
  lemit_invarea.w =
      pdfArea2SolidAngle(lemit_invarea.w, rayOrigin, hitPoint, Ns);
  return STEP_IF_ABOVE_SURFACE(woW, Ns) * lemit_invarea;
}

bool matchBxDFFlag(uint required, uint flags) {
  // required bits must all be on in flags
  return (required & flags) == required;
}

#endif  // _SHADOWRAY_BSDF_

#ifndef _SHADOWRAY_RAND_
#define _SHADOWRAY_RAND_

// https://www.shadertoy.com/view/XlGcRh
// https://www.reedbeta.com/blog/hash-functions-for-gpu-rendering/
// see also https://www.shadertoy.com/view/Xt3cDn
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;

  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;

  v ^= v >> 16u;

  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;

  return v;
}

float rand(inout uvec3 v) {
  uvec3 hash = pcg3d(v);
  v.z += 1;
  return float(hash) * (1.0 / float(0xffffffffu));
}

#endif

#ifndef _SHADOWRAY_DIFFUSE_
#define _SHADOWRAY_DIFFUSE_





// bDOUBLE_FACE = false, bSTRICT_NORMAL = false
float diffuseEvalBSDF(const vec3 N, const vec3 woW, const vec3 wiW) {
  return M_1_PIf * abs(dot(N, wiW));  // no kd
}

// bDOUBLE_FACE = false, bSTRICT_NORMAL = false
float diffuseEvalBSDFPdf(const vec3 N, const vec3 woW, const vec3 wiW) {
  return pdfCosineHemisphere(wiW, N);
}

// f = brdf*cos/pdf
BSDFSampleRecord diffuseSampleBSDF(vec2 bsample, const vec3 KD, const vec3 N,
                                   const vec3 woW) {
  BSDFSampleRecord bsdfSampleRecord;
  bsdfSampleRecord.sampled_type = BSDF_DIFFUSE_REFLECT;  // even if failed?
  const float stp = STEP_IF_ABOVE_SURFACE(woW, N);
  Frame frame = makeFrame(N);  // Ns in world space
  float pdf_w = 0.;
  bsdfSampleRecord.wiW =
      L2W(frame, cosineHemisphere(bsample.x, bsample.y,
                                  pdf_w));  // should remain normalized
  bsdfSampleRecord.f = stp * KD;
  bsdfSampleRecord.pdf_w = pdf_w;
  return bsdfSampleRecord;
}

#endif  // _SHADOWRAY_DIFFUSE_
#ifndef _SHADOWRAY_LIGHT_
#define _SHADOWRAY_LIGHT_




struct XZPlaneQuadLight {
  float y;
  vec2 min, max;
};

LightSampleRecord sampleLight(vec2 u2, vec3 fromHitPoint) {
  const XZPlaneQuadLight ceiling_light = {
      548.29999,
      {213, 227},
      {343, 332},
  };

  vec2 xz = mix(ceiling_light.min, ceiling_light.max, u2);
  vec3 p = vec3(xz[0], ceiling_light.y, xz[1]);
  vec3 n = vec3(0., -1., 0.);
  vec2 d = ceiling_light.max - ceiling_light.min;
  float pdf = 1.0 / (d.x * d.y);

  vec3 dir = normalize(fromHitPoint - p);
  float facing_light = step(0., dot(n, dir));
  // from area measure to solid angle measure
  pdf = facing_light * pdfArea2SolidAngle(pdf, fromHitPoint, p, n);
  const vec3 radiance = facing_light * vec3(15.6) * safe_rcp(pdf);
  LightSampleRecord rec = {{p, n, pdf}, radiance, vec4(0.)};
  return rec;
}

#endif
// clang-format on
#endif
