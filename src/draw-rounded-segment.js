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

uniform float jres2;
uniform vec2 resolution;

varying vec2 lineCoord;

${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  gl_PointSize = 10.0;
  ${debug ? 'instanceID = debugInstanceID;' : ''}
  ${debug ? 'triStripGridCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}

  lineCoord = vec2(0);

  // Project all four points
  vec4 pA = ${meta.position.generate('A')};
  vec4 pB = ${meta.position.generate('B')};
  vec4 pC = ${meta.position.generate('C')};
  vec4 pD = ${meta.position.generate('D')};

  if (invalid(pA) || invalid(pB) || invalid(pC) || invalid(pD)) {
    gl_Position = vec4(0);
    return;
  }

  ${''/* Is the first join+half-segment of the instance */}
  bool isStart = index <= jres2 + 3.0;
  if (isStart) {
    vec4 tmp;
    tmp = pC; pC = pB; pB = tmp;
    tmp = pD; pD = pA; pA = tmp;
  }

  float useC = isStart ? 0.0 : 1.0;
  float _computedWidthB = isStart ? ${meta.width.generate('C')} : ${meta.width.generate('B')};
  float _computedWidthC = isStart ? ${meta.width.generate('B')} : ${meta.width.generate('C')};

  float pBw = pB.w;
  float computedW = pC.w;

  ${''/* Convert to screen-pixel coordinates */}
  pA = vec4(pA.xy * resolution, pA.zw) / pA.w;
  pB = vec4(pB.xy * resolution, pB.zw) / pBw;
  pC = vec4(pC.xy * resolution, pC.zw) / computedW;
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

  vec2 rCD = vec2(pD.xy - pC.xy);
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  float lBCD = min(lBC, lCD);

  ${''/* Left/right turning at each vertex. Use < vs. <= to break tie when collinear. */}
  float dirB = dot(tAB, nBC) < 0.0 ? -1.0 : 1.0;
  float dirC = dot(tBC, nCD) <= 0.0 ? -1.0 : 1.0;

  ${''/* x-component is the index within the part (join vs. fan), y-component is the overall index */}
  vec2 iindex = vec2(index);

  float flip = dirB * dirC;
  if (flip < 0.0) {
    if (iindex.y == jres2 + 2.0) iindex -= 2.0;
  } else {
    if (iindex.y == jres2 + 3.0) iindex -= 3.0;
  }

  vec2 xy = vec2(0);
  mat2 xyBasis = mat2(0);

  gl_Position = pC;
  float dz = 0.0;

  bool selfIntersects = isSelfIntersection(nBC, nCD, _computedWidthC, lBCD);

  if (iindex.y < jres2 + 1.0 || iindex.y >= jres2 + 5.0) {
    vec2 miterNormal = 0.5 * (tCD + tBC);
    float miterNormalLen = length(miterNormal);
    bool isDegenerate = miterNormalLen == 0.0;

    vec2 xBasis = isDegenerate ? nBC : miterNormal / miterNormalLen;
    vec2 yBasis = vec2(-xBasis.y, xBasis.x);
    if (isDegenerate && !isStart) xBasis = -xBasis;
    xyBasis = mat2(xBasis, yBasis);

    ${''/*Adjust indices to get the fan anle correct */}
    if (!isStart) iindex.x = 2.0 * jres2 + 4.0 - iindex.x + 1.0;

    ${''/* Odd-numbered point in this range are around the arc. Every other index is just the center point pC, repeated since has the geometry of a triangle fan */}
    if (mod(iindex.x, 2.0) == 0.0) {
      lineCoord.y = isStart ? -dirC : dirC;
      float cosTheta = clamp(dot(nBC, nCD), -1.0, 1.0);
      float theta = -0.5 * dirC * acos(cosTheta) * (iindex.x / jres2);
      xy = dirC * vec2(sin(theta), cos(theta));

      ${''/* Correct for smooth transition of z around the join, but limit to half the z difference to the next point*/}
      //if (!isDegenerate)
        dz = -(pB.z - pC.z) * clamp(xy.x * _computedWidthC / lBC, -0.5, 0.5);
    }
  } else {
    ${''/* We're in the miter/segment portion */}
    ${''/* Use the turning direction to put the positive line coord on a consistent side */}
    float y = iindex.x == 1.0 ? dirC : -dirC;

    lineCoord.y = isStart ? dirC : -dirC;

    // Extension of miter tangent to the segment
    float mB = miterExtension(tAB, tBC) * _computedWidthB;
    float mC = miterExtension(tBC, tCD) * _computedWidthC;

    ${''/*// Place the corners, with clipping against the opposite end*/}
    float lABC = min(lAB, lBC);
    float abcClip = selfIntersects ? lABC : lBC;
    float bcdClip = selfIntersects ? lBCD : lBC;
    float mB0 = dirB > 0.0 ? min(abcClip, -mB) : 0.0;
    float mC0 = dirC > 0.0 ? min(bcdClip, -mC) : 0.0;
    float mB1 = dirB > 0.0 ? 0.0 : min(abcClip, mB);
    float mC1 = dirC > 0.0 ? 0.0 : min(bcdClip, mC);

    xyBasis = mat2(tBC, nBC);
    bool isStart = iindex.x < 2.0;

    xy = vec2(
      (isStart ?
        ${''/* If start, then use the miter at B */}
        (y > 0.0 ? mB1 : mB0) - lBC :
        ${''/* Else, the miter at C */}
        -(y > 0.0 ? mC1 : mC0)
      ),
      y);

    if (lBC > 0.0) useC = clamp(useC - dirC * xy.x / lBC * lineCoord.y, 0.0, 1.0);

    xy.x /= _computedWidthC;
  }

  ${''/* Compute all varyings with shortening to account for interior miters */}
  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  ${''/* Only make z discontinuous when sharp angle self-intersect. Then treat them like varyings. This *might* prevent z-fighting. */}
  if (selfIntersects) gl_Position.z = mix(pB.z, pC.z, isStart ? 1.0 - useC : useC);

  // Compute the final position
  gl_Position.z += dz;
  gl_Position.xy += _computedWidthC * (xyBasis * xy);
  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: {
      index: {
        buffer: [...Array(400).keys()],
        divisor: 0
      },

    ...indexAttributes,
      ...segmentSpec.attrs
    },
    uniforms: {
      jres2: (ctx, props) => props.joinResolution * 2
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: (ctx, props) => 4 * props.joinResolution + 6
  });
}
