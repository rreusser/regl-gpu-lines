const ORIENTATION = require('./orientation.json');

module.exports = `
#ifndef PI
#define PI ${Math.PI}
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
}`;
