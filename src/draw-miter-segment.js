'use strict';

const glslPrelude = require('./glsl-prelude.js');

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

${debug ? 'attribute float index;' : ''}
${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripGridCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

${glslPrelude}

void main() {
  ${debug ? 'instanceID = debugInstanceID;' : ''}
  ${debug ? 'triStripGridCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}
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

  float useC = 1.0;
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
      useC = 0.0;
      computedWidth = _computedWidthB;
      computedW = pBw;
    }

    float m = miterExtension(isStart ? tAB : tBC, isStart ? tBC : tCD);
    float lABC = min(lAB, lBC);
    float lBCD = min(lBC, lCD);
    float m0_abc = min(-m * computedWidth, lABC);
    float m1_abc = min(m * computedWidth, lABC);
    float m0_bcd = min(-m * computedWidth, lBCD);
    float m1_bcd = min(m * computedWidth, lBCD);

    gl_Position.xy += linePosition.y * computedWidth * nBC;

    if (isStart) {
      gl_Position.z = pB.z;
      float dirB = dot(tAB, nBC) < 0.0 ? -1.0 : 1.0;
      bool bIsOuter = dirB * linePosition.y > 0.0;
      gl_Position.xy -= tBC * (lBC - (linePosition.y < 0.0 ? m0_abc : m1_abc) * (bIsOuter ? 0.0 : 1.0));
    } else {
      bool cIsOuter = dirC * linePosition.y > 0.0;
      bool clipC = abs(m) > miterLimit;
      gl_Position.xy -= tBC * (linePosition.y > 0.0 ? m1_bcd : m0_bcd) * (cIsOuter && clipC ? 0.0 : 1.0);
    }
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'C', 'B')).join('\n')}

  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...segmentSpec.attrs,
      linePosition: {
        buffer: [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1]],
        divisor: 0
      },
    },
    uniforms: {
      miterLimit: (ctx, props) =>
        Math.sqrt(props.miterLimit * props.miterLimit - 1)
    },
    primitive: 'triangle strip',
    instances: (ctx, props) => props.count - 3,
    count: 5
  });
}
