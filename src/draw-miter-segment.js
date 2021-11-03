'use strict';

module.exports = createDrawMiterSegmentCommand;

function createDrawMiterSegmentCommand({
  regl,
  frag,
  meta,
  segmentSpec,
  indexAttributes,
  debug
}) {
  return regl({
    vert: `${meta.glsl}

attribute vec2 linePosition;
${segmentSpec.glsl}

uniform float miterLimit;
uniform vec2 resolution;

varying vec2 lineCoord;
varying float computedWidth;

${debug ? 'attribute vec2 indexBarycentric;' : ''}
${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 barycentric;' : ''}
${debug ? 'varying float instanceID;' : ''}

float miterExtension(vec2 t01, vec2 t12) {
  float cosTheta = dot(t01, t12);
  if (cosTheta < -0.9999999) return 0.0;
  float sinTheta = t01.x * t12.y - t01.y * t12.x;
  return sinTheta / (1.0 + cosTheta);
}

bool isnan(float val) {
  return ( val < 0.0 || 0.0 < val || val == 0.0 ) ? false : true;
}

void main() {
  ${debug ? 'barycentric = indexBarycentric;' : ''}
  ${debug ? 'instanceID = debugInstanceID;' : ''}
  lineCoord.x = 0.0;
  lineCoord.y = linePosition.y;

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

  float _computedWidthB = ${meta.width.generate('B')};
  float _computedWidthC = ${meta.width.generate('C')};
  computedWidth = _computedWidthC;

  bool useC = true;
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
  vec2 rAB = pB.xy - pA.xy;
  vec2 rBC = pC.xy - pB.xy;
  vec2 rCD = pD.xy - pC.xy;
  float lAB = length(rAB);
  float lBC = length(rBC);
  float lCD = length(rCD);

  if (lBC < 0.01) {
    gl_Position = vec4(0);
    return;
  }

  vec2 tAB = rAB / lAB;
  vec2 tBC = rBC / lBC;
  vec2 tCD = rCD / lCD;

  vec2 nBC = vec2(-tBC.y, tBC.x);
  vec2 nCD = vec2(-tCD.y, tCD.x);

  gl_Position = pC;

  float dirC = dot(tBC, nCD) < 0.0 ? -1.0 : 1.0;
  if (linePosition.x > 1.0) {
    gl_Position.xy += dirC * linePosition.y * computedWidth * nCD;
    lineCoord.y = dirC;
  } else {
    bool isStart = linePosition.x < 0.5;

    if (isStart) {
      useC = false;
      computedWidth = _computedWidthB;
      computedW = pBw;
    }

    float m = miterExtension(isStart ? tAB : tBC, isStart ? tBC : tCD);
    float m0 = min(-m * computedWidth, lBC);
    float m1 = min(m * computedWidth, lBC);

    gl_Position.xy += linePosition.y * computedWidth * nBC;

    if (isStart) {
      gl_Position.z = pB.z;
      float dirB = dot(tAB, nBC) < 0.0 ? -1.0 : 1.0;
      bool bIsOuter = dirB * linePosition.y > 0.0;
      gl_Position.xy -= tBC * (lBC - (linePosition.y < 0.0 ? m0 : m1) * (bIsOuter ? 0.0 : 1.0));
    } else {
      bool cIsOuter = dirC * linePosition.y > 0.0;
      bool clipC = abs(m) > miterLimit;
      gl_Position.xy -= tBC * (linePosition.y > 0.0 ? m1 : m0) * (cIsOuter && clipC ? 0.0 : 1.0);
    }
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'C', 'B')).join('\n')}

  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: Object.assign(
      {
        linePosition: {
          // prettier-ignore
          buffer: debug
            // Expand triangles for debug
            ? [
                [0, -1],[1, -1],[0, 1],
                [0,  1],[1, -1],[1, 1],
                [1,  1],[1, -1],[2, 1]
              ]
            // Render as a triangle strip to minimize vertex evaluations
            : [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1]],
          divisor: 0
        },
        ...segmentSpec.attrs
      },
      debug
        ? {
            indexBarycentric: {
              buffer: [0, 1, 2].map(() => [[0, 0], [1, 0], [0, 1]]).flat(),
              divisor: 0
            },
            debugInstanceID: indexAttributes.debugInstanceID
          }
        : {}
    ),
    uniforms: {
      miterLimit: (ctx, props) =>
        Math.sqrt(props.miterLimit * props.miterLimit - 1)
    },
    primitive: debug ? 'triangles' : 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: debug ? 9 : 5
  });
}
