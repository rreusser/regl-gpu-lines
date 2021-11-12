'use strict';

const glslPrelude = require('./glsl-prelude.js');

module.exports = createDrawSegmentCommand;

function createDrawSegmentCommand(isRound, {
  regl,
  meta,
  frag,
  segmentSpec,
  indexAttributes,
  debug
}) {
  return regl({
    vert: `${meta.glsl}

attribute float index;
${segmentSpec.glsl}

//uniform float joinRes2;
uniform vec2 joinRes;
uniform vec2 resolution;
uniform float miterLimit2;

varying vec2 lineCoord;
varying float isMiter;

${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  const bool useRound = ${isRound ? 'true' : 'false'};

  isMiter = 1.0;
  ${debug ? 'instanceID = debugInstanceID;' : ''}
  ${debug ? 'triStripGridCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}

  lineCoord = vec2(0);

  ${'' /* Project all four points */}
  vec4 pA = ${meta.position.generate('A')};
  vec4 pB = ${meta.position.generate('B')};
  vec4 pC = ${meta.position.generate('C')};
  vec4 pD = ${meta.position.generate('D')};

  if (invalid(pA) || invalid(pB) || invalid(pC) || invalid(pD)) {
    gl_Position = vec4(0);
    return;
  }

  ${''/* Is the first join+half-segment of the instance */}
  bool isFirstSeg = index <= joinRes.x * 2.0 + 3.0;
  vec2 res = isFirstSeg ? joinRes : joinRes.yx;
  float swapSign = isFirstSeg ? 1.0 : -1.0;
  float useC = 0.0;
  if (!isFirstSeg) {
    vec4 tmp;
    tmp = pC; pC = pB; pB = tmp;
    tmp = pD; pD = pA; pA = tmp;
    useC = 1.0;
  }

  float computedWidthB = isFirstSeg ? ${meta.width.generate('B')} : ${meta.width.generate('C')};

  ${''/* Convert to screen-pixel coordinates */}
  float pBw = pB.w;
  pA = vec4(vec3(pA.xy * resolution, pA.z) / pA.w, 1);
  pB = vec4(vec3(pB.xy * resolution, pB.z) / pB.w, 1);
  pC = vec4(vec3(pC.xy * resolution, pC.z) / pC.w, 1);
  pD = vec4(vec3(pD.xy * resolution, pD.z) / pD.w, 1);

  ${''/* Invalidate triangles too far in front of or behind the camera plane */}
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    gl_Position = vec4(0);
    return;
  }

  ${''/* Tangent and normal vectors */}
  vec2 tBC = pC.xy - pB.xy;
  float lBC = length(tBC);
  tBC /= lBC;
  vec2 nBC = vec2(-tBC.y, tBC.x);

  vec2 tAB = pB.xy - pA.xy;
  float lAB = length(tAB);
  tAB /= lAB;
  vec2 nAB = vec2(-tAB.y, tAB.x);

  vec2 rCD = pD.xy - pC.xy;
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  // This section is very fragile. When lines are collinear, signs flip randomly and break orientation
  // of the middle segment. So we detect and fix three different cases (b collinear, c collinear, b and
  // c collinear).
  const float tol = 1e-4;
  float sgnB = dot(tAB, nBC);
  float sgnC = dot(tBC, nCD);
  float dirB = sign(sgnB);
  float dirC = sign(sgnC);
  bool bCollinear = abs(sgnB) < tol;
  bool cCollinear = abs(sgnC) < tol;
  if (bCollinear && cCollinear) {
    // When both collinear, assign signs arbitrarily
    dirB = 1.0;
    dirC = -1.0;
  } else if (bCollinear) {
    // When only B collinear, assign its sign based on C
    dirB = dirC;
  } else if (cCollinear) {
    // When only C collinear, assign its sign from B
    dirC = dirB;
  }

  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  float i = index < 2.0 * joinRes.x + 4.0 ? index : 2.0 * (res.x + res.y) + 5.0 - index;
  float iSeg = i - 2.0 * res.x;

  if (iSeg > 1.0 && iSeg <= 3.0) {
    iSeg -= 2.0;
    if (dirB * dirC >= 0.0) iSeg += iSeg == 0.0 ? 1.0 : -1.0;
  }

  vec2 xBasis = tBC;
  vec2 yBasis = nBC * dirB;
  vec2 xy = vec2(0, 1);

  lineCoord.y = dirB * swapSign;

  if (iSeg < 0.0) {
    vec2 m = 0.5 * (nAB + nBC) * dirB;
    float m2 = dot(m, m);
    float lm = length(m);
    yBasis = m / lm;

    bool isBevel = 1.0 > miterLimit2 * m2;

    if (mod(i, 2.0) == 0.0) {
      // Outer joint points
      if (useRound) {
        xBasis = dirB * vec2(yBasis.y, -yBasis.x);
        float theta = 0.25 * acos(cosB) * (i / res.x);
        xy = vec2(sin(theta), cos(theta));
      } else {
        yBasis = m;
        if (!isBevel) xy.y /= m2;
      }
    } else {
      // vertex B
      lineCoord.y = 0.0;
      xy = vec2(0);
      if (!useRound) {
        if (isBevel) xy.y = sqrt((1.0 + cosB) * 0.5) - 1.0;
      }
    }
  //} else if (iSeg == 0.0) { // vertex B + line B-C normal
  } else if (iSeg > 0.0) {
    lineCoord.y = -lineCoord.y;

    // vertex B + inner miter
    float miterExt = 0.0;
    if (cosB > -1.0) {
      float sinB = tAB.x * tBC.y - tAB.y * tBC.x;
      miterExt = sinB / (1.0 + cosB);
    }
    float m = abs(miterExt) * computedWidthB;
    m = min(m, min(lBC, lAB));
    xy = vec2(m, -1);
    useC = useC + xy.x / lBC * swapSign;
    xy.x /= computedWidthB;
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  gl_Position = pB;
  gl_Position.xy += computedWidthB * (mat2(xBasis, yBasis) * xy);
  gl_Position.xy /= resolution;
  gl_Position *= pBw;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...segmentSpec.attrs
    },
    uniforms: {
      //joinRes2: isRound ? (ctx, props) => (props.joinResolution + props.capResolution): 2,
      joinRes: isRound ? (ctx, props) => [props.joinResolution, props.capResolution] : [1, 1],
      miterLimit2: (ctx, props) => props.miterLimit * props.miterLimit
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: isRound ? (ctx, props) => 2 * (props.joinResolution + props.capResolution) + 6 : 10
  });
}
