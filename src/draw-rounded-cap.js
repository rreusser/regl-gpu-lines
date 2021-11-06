'use strict';

const ORIENTATION = require('./orientation.json');
const glslPrelude = require('./glsl-prelude.js');

module.exports = createDrawRoundedCapCommand;

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
//         ...1 ------------------------ 3 -5
//      ..    | ...                     /|    7
//     .      |     ...                / |     \
//     .      |         ...           /  + ---- 9
//     .      |            ...       /  / \ _ -
//      ..    |                ...  / / _ -\
//         ...0 ------------------ x -      \
//                                  \        + 4, 6, 8 (= pC)
//                                   \
//                                    +- 2, 10
//
function createDrawRoundedCapCommand({
  regl,
  meta,
  frag,
  endpointSpec,
  indexAttributes,
  indexPrimitive,
  debug
}) {
  return regl({
    vert: `${meta.glsl}

attribute float index;
${endpointSpec.glsl}

uniform float joinResolution, capResolution2;
uniform vec2 resolution, capScale;
${meta.orientation ? '' : 'uniform float uOrientation;'}

varying vec2 lineCoord;
varying float computedWidth;

${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  ${debug ? 'instanceID = -1.0;' : ''}
  ${debug ? 'triStripGridCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}
  lineCoord = vec2(0);

  float orientation = ${meta.orientation ? meta.orientation.generate('') : 'mod(uOrientation,2.0)'};

  // Project points
  vec4 pB = ${meta.position.generate('B')};
  vec4 pC = ${meta.position.generate('C')};
  vec4 pD = ${meta.position.generate('D')};

  if (pB.w == 0.0 || pC.w == 0.0 || pD.w == 0.0) {
    gl_Position = vec4(0);
    return;
  }

  float widthB = ${meta.width.generate('B')};
  float widthC = ${meta.width.generate('C')};
  computedWidth = widthC;

  bool useC = true;
  float pBw = pB.w;
  float computedW = pC.w;

  // Convert to screen-pixel coordinates
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

  vec2 rCD = pD.xy - pC.xy;
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  // Left/right turning at each vertex
  // Note: don't use sign for this! It's zero when the line is straight.
  float dirC = dot(tBC, nCD) < 0.0 ? -1.0 : 1.0;

  float i = index;
  float iLast = joinResolution * 2.0 + capResolution2 + 4.0;

  // Flip indexing if we turn the opposite direction, so that we draw backwards
  // and get the winding order correct
  if (dirC > 0.0) i = iLast - i;

  vec2 xy = vec2(0);
  mat2 xyBasis = mat2(0);

  if (i < capResolution2 + 1.0) {
    // The first few vertices are on the cap.
    i -= capResolution2;
    gl_Position = pB;
    computedWidth = widthB;
    useC = false;
    computedW = pBw;

    if (mod(i, 2.0) == 1.0) {
      lineCoord = vec2(0);
    } else {
      mat2 xyBasis = mat2(tBC, nBC);
      xyBasis = mat2(tBC, nBC);
      float theta = i / capResolution2 * PI;
      xy = vec2(sin(theta), -cos(theta) * dirC);
      if (abs(xy.x) > 0.1) xy *= capScale;
      lineCoord = xy;
      if (orientation == CAP_END) lineCoord.y = -lineCoord.y;
      gl_Position.xy += computedWidth * (xyBasis * xy);
    }
  } else {
    i -= capResolution2;
    iLast = joinResolution * 2.0 + 4.0;

    gl_Position = pC;

    bool isSegment = i <= 2.0 || i == iLast;
    if (!isSegment && orientation == CAP_END) i = 3.0;
    if (i <= 2.0 || i == iLast) {
      // We're in the miter/segment portion

      // Use the turning direction to put the positive line coord on a consistent side
      lineCoord.y = i == 1.0 ? dirC : -dirC;

      // Extension of miter tangent to the segment
      float mC = miterExtension(tBC, tCD) * widthC;

      // Place the corners, with clipping against the opposite end
      float lBCD = min(lBC, lCD);
      float mC0 = dirC > 0.0 ? min(lBCD, -mC) : 0.0;
      float mC1 = dirC > 0.0 ? 0.0 : min(lBCD, mC);

      xyBasis = mat2(tBC, nBC);
      bool isStart = i < 2.0;
      if (isStart) {
        useC = false;
        computedWidth = widthB;
        computedW = pBw;
      }
      gl_Position.z = isStart ? pB.z : pC.z;
      xy = vec2(
        (isStart ?
          // If so, then use the miter at B
          -lBC :

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

    if (orientation == CAP_END) lineCoord.y = -lineCoord.y;

    // Compute the final position
    gl_Position.xy += computedWidth * (xyBasis * xy);
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'C', 'B')).join('\n')}

  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...endpointSpec.attrs
    },
    uniforms: {
      joinResolution: regl.prop('joinResolution'),
      capResolution2: (ctx, props) => props.capResolution * 2,
      uOrientation: regl.prop('orientation'),
      capScale: regl.prop('capScale')
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.splitCaps ? (props.orientation === ORIENTATION.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2)) : props.count,
    count: (ctx, props) => (props.joinResolution + props.capResolution) * 2 + 5
  });
}
