const ORIENTATION = require('./orientation.json');

module.exports = `
#ifndef PI
#define PI 3.141592653589793
#endif

#define CAP_START ${ORIENTATION.CAP_START}.0
#define CAP_END ${ORIENTATION.CAP_END}.0

float miterExtension(vec2 t01, vec2 t12) {
  float cosTheta = dot(t01, t12);
  if (cosTheta - 1e-7 < -1.0) return 0.0;
  float sinTheta = t01.x * t12.y - t01.y * t12.x;
  return sinTheta / (1.0 + cosTheta);
}

bool isnan(float val) {
  return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
}

bool invalid(vec4 p) {
  return p.w==0.0||isnan(p.x);
}

bool isSelfIntersection(vec2 tBC, vec2 tCD, float widthC, float lBCD) {
  if (dot(tBC, tCD) > 0.0) return false;
  return length(tBC + tCD) * lBCD < 2.0 * widthC;
}`;
