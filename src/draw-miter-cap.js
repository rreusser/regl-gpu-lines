'use strict';

const ORIENTATION = require('./orientation.json');
const glslPrelude = require('./glsl-prelude.js');

module.exports = createDrawMiterCapCommand;

function createDrawMiterCapCommand({
  regl,
  frag,
  meta,
  endpointSpec,
  indexPrimitive,
  indexAttributes,
  debug
}) {
  return regl({
    vert: `${meta.glsl}

attribute float index;
${endpointSpec.glsl}

uniform float miterLimit, capResolution2;
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

  ${''/* Project points */}
  vec4 pB = ${meta.position.generate('B')};
  vec4 pC = ${meta.position.generate('C')};
  vec4 pD = ${meta.position.generate('D')};

  float widthB = ${meta.width.generate('B')};
  float widthC = ${meta.width.generate('C')};
  computedWidth = widthC;

  float useC = 1.0;
  float pBw = pB.w;
  float computedW = pC.w;

  ${''/* Convert to screen-pixel coordinates */}
  pB = vec4(pB.xy * resolution, pB.zw) / pBw;
  pC = vec4(pC.xy * resolution, pC.zw) / computedW;
  pD = vec4(pD.xy * resolution, pD.zw) / pD.w;

  if (pB.w == 0.0 || pC.w == 0.0 || pD.w == 0.0) {
    gl_Position = vec4(0);
    return;
  }

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

  vec2 rCD = pD.xy - pC.xy;
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  gl_Position = pC;

  ${''/* Left/right turning at each vertex */}
  ${''/* Note: don't use sign for this! It's zero when the line is straight. */}
  float dirC = dot(tBC, nCD) < 0.0 ? -1.0 : 1.0;
  float endSign = orientation == CAP_START ? 1.0 : -1.0;

  float i = index;
  float iLast = capResolution2 + 4.0;

  ${''/* Flip indexing if we turn the opposite direction, so that we draw backwards */}
  ${''/* and get the winding order correct */}
  if (dirC > 0.0) i = iLast - i;

  vec2 xy = vec2(0);
  mat2 xyBasis = mat2(0);

  if (i <= capResolution2) {
    ${''/* The first few vertices are on the cap. */}
    gl_Position = pB;

    computedWidth = widthB;
    computedW = pBw;
    useC = 0.0;

    if (mod(i, 2.0) == 0.0) {
      xyBasis = mat2(-tBC, nBC * dirC);
      float theta = i / capResolution2 * PI;
      lineCoord = vec2(sin(theta), cos(theta));
      if (abs(lineCoord.x) > 0.1) lineCoord *= capScale;
      gl_Position.xy += computedWidth * (xyBasis * lineCoord);
      lineCoord.y *= dirC * endSign;
    }
  } else {
    i -= capResolution2 + 1.0;

    vec2 position;
    if (i == 0.0) position = vec2(0, 1);
    if (i == 1.0) position = vec2(1, -1);
    if (i >= 2.0) position = vec2(1, 1);
    if (i == 3.0 && orientation == CAP_START) position = vec2(2, 1);

    position.y *= dirC;
    lineCoord.y = position.y * endSign;

    if (position.x > 1.0) {
      gl_Position.xy += position.y * computedWidth * nCD;
    } else {
      bool isSegmentStart = position.x < 0.5;

      if (isSegmentStart) {
        computedWidth = widthB;
        computedW = pBw;
        useC = 0.0;
        gl_Position = pB;
      }

      gl_Position.xy += position.y * computedWidth * nBC;

      if (!isSegmentStart) {
        float m = miterExtension(tBC, tCD);
        float lBCD = min(lBC, lCD);
        float m0 = min(-m * computedWidth, lBCD);
        float m1 = min(m * computedWidth, lBCD);
        bool cIsOuter = dirC * position.y > 0.0;
        bool clipC = abs(m) > miterLimit;
        gl_Position.xy -= tBC * (position.y > 0.0 ? m1 : m0) * (cIsOuter && (clipC || orientation == CAP_END) ? 0.0 : 1.0);
      }
    }
  }

  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  gl_Position.xy /= resolution;
  gl_Position *= computedW;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...endpointSpec.attrs
    },
    uniforms: {
      uOrientation: regl.prop('orientation'),
      capScale: regl.prop('capScale'),
      capResolution2: (ctx, props) => props.capResolution * 2,
      miterLimit: (ctx, props) => Math.sqrt(props.miterLimit * props.miterLimit - 1)
    },
    primitive: indexPrimitive,
    instances: (ctx, props) => props.splitCaps ? (props.orientation === ORIENTATION.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2)) : props.count,
    count: (ctx, props) => props.capResolution * 2 + 5
  });
}
