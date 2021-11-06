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
  indexPrimitive,
  indexAttributes,
  debug
}) {
  return regl({
    vert: `${meta.glsl}

attribute float index;
${segmentSpec.glsl}

uniform float joinResolution;
uniform vec2 resolution;

varying vec2 lineCoord;
varying float computedWidth;

${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  ${debug ? 'instanceID = debugInstanceID;' : ''}
  ${debug ? 'triStripGridCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}
  lineCoord = vec2(0);


  // Project all four points
  vec4 pA = ${meta.position.generate('A')};
  vec4 pB = ${meta.position.generate('B')};
  vec4 pC = ${meta.position.generate('C')};
  vec4 pD = ${meta.position.generate('D')};

  if (pA.w == 0.0 || pB.w == 0.0 || pC.w == 0.0 || pD.w == 0.0 ||
    isnan(pA.x) || isnan(pB.x) || isnan(pC.x) || isnan(pD.x)) {
    gl_Position = vec4(0);
    return;
  }

  bool useC = true;
  float _computedWidthB = ${meta.width.generate('B')};
  float _computedWidthC = ${meta.width.generate('C')};
  computedWidth = _computedWidthC;

  float pBw = pB.w;
  float computedW = pC.w;

  // Convert to screen-pixel coordinates
  pA = vec4(pA.xy * resolution, pA.zw) / pA.w;
  pB = vec4(pB.xy * resolution, pB.zw) / pBw;
  pC = vec4(pC.xy * resolution, pC.zw) / computedW;
  pD = vec4(pD.xy * resolution, pD.zw) / pD.w;

  // Invalidate triangles too far in front of or behind the camera plane
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    gl_Position = vec4(0);
    return;
  }

  // Tangent and normal vectors
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

  // Left/right turning at each vertex
  float dirB = dot(tAB, nBC) < 0.0 ? -1.0 : 1.0;
  float dirC = dot(tBC, nCD) < 0.0 ? -1.0 : 1.0;

  float i = index;
  float iLast = joinResolution * 2.0 + 4.0;

  // Flip indexing if we turn the opposite direction, so that we draw backwards
  // and get the windind order correct
  if (dirC > 0.0) i = iLast - i;

  vec2 xy = vec2(0);
  mat2 xyBasis = mat2(0);

  gl_Position = pC;
  gl_Position.z = i < 2.0 ? pB.z : pC.z;

  if (i <= 2.0 || i == iLast) {
    // We're in the miter/segment portion

    // Use the turning direction to put the positive line coord on a consistent side
    lineCoord.y = i == 1.0 ? dirC : -dirC;

    // Extension of miter tangent to the segment
    float mB = miterExtension(tAB, tBC) * _computedWidthB;
    float mC = miterExtension(tBC, tCD) * _computedWidthC;

    // Place the corners, with clipping against the opposite end
    float lABC = min(lAB, lBC);
    float lBCD = min(lBC, lCD);
    float mB0 = dirB > 0.0 ? min(lABC, -mB) : 0.0;
    float mC0 = dirC > 0.0 ? min(lBCD, -mC) : 0.0;
    float mB1 = dirB > 0.0 ? 0.0 : min(lABC, mB);
    float mC1 = dirC > 0.0 ? 0.0 : min(lBCD, mC);

    xyBasis = mat2(tBC, nBC);
    bool isStart = i < 2.0;
    if (isStart) {
      useC = false;
      computedWidth = _computedWidthB;
      computedW = pBw;
    }
    xy = vec2(
      (isStart ?
        // If start, then use the miter at B
        (lineCoord.y > 0.0 ? mB1 : mB0) - lBC :

        // Else, the miter at C
        -(lineCoord.y > 0.0 ? mC1 : mC0)
      ) / computedWidth,
      lineCoord.y
    );
  } else {
    gl_Position.z = pC.z;
    vec2 xBasis = normalize(tCD + tBC);
    vec2 yBasis = vec2(-xBasis.y, xBasis.x);
    xyBasis = mat2(xBasis, yBasis);

    if (mod(i, 2.0) != 0.0) {
      // Odd-numbered point in this range are around the arc. (Even numbered points in this
      // range are a no-op and fall through to just point C)
      lineCoord.y = dirC;

      // Our indexing is offset by three, and every other index is just the center point
      // pC (which we repeat a bunch since we're drawing a triangle strip)
      i = (i - 3.0) * 0.5;
      if (dirC > 0.0) i = joinResolution - i;

      float theta = acos(clamp(dot(nBC, nCD), -1.0, 1.0)) * (0.5 - i / joinResolution);
      xy = dirC * vec2(sin(theta), cos(theta));
    }
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'C', 'B')).join('\n')}

  // Compute the final position
  gl_Position.xy += computedWidth * (xyBasis * xy);
  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...segmentSpec.attrs
    },
    uniforms: {
      joinResolution: regl.prop('joinResolution'),
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: (ctx, props) => props.joinResolution * 2 + 5
  });
}
