'use strict';

const glslPrelude = require('./glsl-prelude.js');

module.exports = createDrawRoundedSegmentCommand;

// The segment is rendered as a triangle strip. Consider joinResolution = 3. We start
// at the mitered end of the line and render vertices:
//
// - 0, 1, 2: mitered vertices, using beveled line logic
// - 3, 5, 7, 9: vertices around the circular arc join
// - 4, 6, 8: repeated vertices at point C to accomplish a triangle fan
// - 10: a final vertex to close it off
//
// Is it worthwhile? I don't know. Consider that as independent triangles, this would
// contain 7 triangles (= 21 independent vertices) which we instead render using eleven.
//
//   1 ------------------------ 3 -5
//   | ...                     /|    7
//   |     ...                / |     \
//   |         ...           /  + ---- 9
//   |            ...       /  / \ _ -
//   |                ...  / / _ -\
//   0 ------------------ x -      \
//                         \        + 4, 6, 8 (= pC)
//                          \
//                           +- 2, 10
//
function createDrawRoundedSegmentCommand({
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

uniform float joinRes2;
uniform vec2 resolution;

varying vec2 lineCoord;
varying float isMiter;

${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  const bool useRound = true;

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
  bool isFirstSeg = index <= joinRes2 + 3.0;
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
  pA = vec4(pA.xy * resolution, pA.zw) / pA.w;
  pB = vec4(pB.xy * resolution, pB.zw) / pB.w;
  pC = vec4(pC.xy * resolution, pC.zw) / pC.w;
  pD = vec4(pD.xy * resolution, pD.zw) / pD.w;

  ${''/* Invalidate triangles too far in front of or behind the camera plane */}
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    gl_Position = vec4(0);
    return;
  }

  ${''/* Tangent and normal vectors */}
  vec2 rBC = pC.xy - pB.xy;
  float lBC = length(rBC);
  vec2 tBC = rBC / lBC;
  vec2 nBC = vec2(-tBC.y, tBC.x);

  vec2 rAB = pB.xy - pA.xy;
  float lAB = length(rAB);
  vec2 tAB = rAB / lAB;
  vec2 nAB = vec2(-tAB.y, tAB.x);

  vec2 rCD = vec2(pD.xy - pC.xy);
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-rCD.y, rCD.x);

  float dirB = dot(tAB, nBC) < 0.0 ? -1.0 : 1.0;
  float dirC = dot(tBC, nCD) <= 0.0 ? -1.0 : 1.0;
  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  float i = index < joinRes2 + 4.0 ? index : 2.0 * joinRes2 + 5.0 - index;
  float iSeg = i - joinRes2;

  if (iSeg > 1.0 && iSeg <= 3.0) {
    iSeg -= 2.0;
    if (dirB * dirC > 0.0) iSeg += iSeg == 0.0 ? 1.0 : -1.0;
  }

  vec2 xBasis = tBC;
  vec2 yBasis = nBC * dirB;
  vec2 xy = vec2(0, 1);

  lineCoord.y = dirB * swapSign;

  if (iSeg < 0.0) {
    if (mod(i, 2.0) == 0.0) {
      // Outer joint points
      vec2 m = 0.5 * (nAB + nBC) * dirB;
      if (useRound) {
        yBasis = normalize(m);
        xBasis = dirB * vec2(yBasis.y, -yBasis.x);
        float theta = 0.5 * acos(cosB) * (i / joinRes2);
        xy = vec2(sin(theta), cos(theta));
      } else {
        yBasis = m;
      }
    } else {
      // vertex B
      lineCoord.y = 0.0;
      xy = vec2(0);
      //if (!useRound) { TODO: fix SDF }
    }
  //} else if (iSeg == 0.0) { // vertex B + line B-C normal
  } else if (iSeg > 0.0) {
    lineCoord.y = -lineCoord.y;

    // vertex B + inner miter
    float miterExt = 0.0;
    if (cosB > -0.98) {
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
      joinRes2: (ctx, props) => props.joinResolution * 2
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: (ctx, props) => 4 * props.joinResolution + 6
  });
}
