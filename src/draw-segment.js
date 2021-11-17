'use strict';

const ORIENTATION = require('./constants/orientation.json');

module.exports = createDrawSegmentCommand;

function createDrawSegmentCommand(isRound, isEndpoints, {
  regl,
  meta,
  frag,
  segmentSpec,
  endpointSpec,
  indexAttributes,
  insertCaps,
  debug,
}) {
  const spec = isEndpoints ? endpointSpec : segmentSpec;
  const verts = ['B', 'C', 'D'];
  if (!isEndpoints) verts.unshift('A');

  function computeCount(props) {
    return insertCaps
      ? isEndpoints
        // Cap has fixed number, join could either be a cap or a join
        ? [props.capResolution, Math.max(props.capResolution, props.joinResolution)]
        // Both could be either a cap or a join
        : [Math.max(props.capResolution, props.joinResolution), Math.max(props.capResolution, props.joinResolution)]
      : isEndpoints
        // Draw a cap
        ? [props.capResolution, props.joinResolution]
        // Draw two joins
        : [props.joinResolution, props.joinResolution];
  }

  return regl({
    vert: `${meta.glsl}
const float CAP_START = ${ORIENTATION.CAP_START}.0;
const float CAP_END = ${ORIENTATION.CAP_END}.0;

${spec.glsl}

attribute float index;
${debug ? 'attribute float debugInstanceID;' : ''}

uniform vec2 vertexCount, capJoinRes;
uniform vec2 resolution, capScale;
uniform float miterLimit;
${meta.orientation || !isEndpoints ? '' : 'uniform float orientation;'}

varying vec3 lineCoord;
varying float dir;
${debug ? 'varying vec2 triStripCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

bool isnan(float val) {
  return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;
}

bool invalid(vec4 p) {
  return p.w == 0.0 || isnan(p.x);
}

const bool isRound = ${isRound ? 'true' : 'false'};
const float pi = 3.141592653589793;

void main() {
  lineCoord = vec3(0);

  ${debug ? `instanceID = ${isEndpoints ? '-1.0' : 'debugInstanceID'};` : ''}
  ${debug ? 'triStripCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}

  ${verts.map(vert => `vec4 p${vert} = ${meta.position.generate(vert)};`).join('\n')}

  // Check for invalid vertices
  if (invalid(pB) || invalid(pC)) {
    gl_Position = vec4(1,1,1,0);
    return;
  }

  float mirrorIndex = 2.0 * vertexCount.x + 3.0;
  float totalVertexCount = mirrorIndex + 2.0 + 2.0 * vertexCount.y;

  // If we're past the first half-join and half of the segment, then we swap all vertices and start
  // over from the opposite end.
  bool isMirrored = index > mirrorIndex;

  // When rendering dedicated endoints, this allows us to insert an end cap *alone* (without the attached
  // segment and join)
  ${isEndpoints ? 'if (invalid(pD) && isMirrored) { gl_Position = vec4(0); return; }' : ''}

  // Convert to screen-pixel coordinates
  // Save w so we can perspective re-multiply at the end to get varyings depth-correct
  float pw = isMirrored ? pC.w : pB.w;
  ${verts.map(v => `p${v} = vec4(vec3(p${v}.xy * resolution, p${v}.z) / p${v}.w, 1);`).join('\n')}

  // If it's a cap, mirror A back onto C to accomplish a round
  ${isEndpoints ? `vec4 pA = pC;` : ''}

  float mirrorSign = isMirrored ? -1.0 : 1.0;
  if (isMirrored) {
    vec4 tmp;
    tmp = pC; pC = pB; pB = tmp;
    tmp = pD; pD = pA; pA = tmp;
  }

  ${isEndpoints ? `bool isCap = !isMirrored;` : `bool isCap = false;`};

  if (invalid(pA)) { ${insertCaps ? 'pA = pC; isCap = true;' : 'pA = 2.0 * pB - pC;'} }
  if (invalid(pD)) { ${insertCaps ? 'pD = pB;' : 'pD = 2.0 * pC - pB;'} }

  float width = isMirrored ? ${meta.width.generate('C')} : ${meta.width.generate('B')};

  // Invalidate triangles too far in front of or behind the camera plane
  if (max(abs(pB.z), abs(pC.z)) > 1.0) {
    gl_Position = vec4(0);
    return;
  }

  // Tangent and normal vectors
  vec2 tBC = pC.xy - pB.xy;
  float lBC = length(tBC);
  tBC /= lBC;
  vec2 nBC = vec2(-tBC.y, tBC.x);

  vec2 tAB = pB.xy - pA.xy;
  float lAB = length(tAB);
  if (lAB > 0.0) tAB /= lAB;
  vec2 nAB = vec2(-tAB.y, tAB.x);

  vec2 tCD = pD.xy - pC.xy;
  float lCD = length(tCD);
  if (lCD > 0.0) tCD /= lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  // This section is very fragile. When lines are collinear, signs flip randomly and break orientation
  // of the middle segment. The fix appears straightforward, but this took a few hours to get right.
  const float tol = 1e-4;
  float dirB = -dot(tBC, nAB);
  float dirC = dot(tBC, nCD);
  bool bCollinear = abs(dirB) < tol;
  bool cCollinear = abs(dirC) < tol;
  bool bIsHairpin = bCollinear && cosB < 0.0;
  bool cIsHairpin = cCollinear && dot(tBC, tCD) < 0.0;
  dirB = bCollinear ? -mirrorSign : sign(dirB);
  dirC = cCollinear ? -mirrorSign : sign(dirC);

  vec2 miter = bIsHairpin ? -tBC : 0.5 * (nAB + nBC) * dirB;

  // The second half of the triangle strip instance is just the first, reversed, and with vertices swapped!
  float i = index <= mirrorIndex ? index : totalVertexCount - index;

  // Chop off the join to get at the segment part index
  float iSeg = i - 2.0 * (isMirrored ? vertexCount.y : vertexCount.x);

  // After the first half-join, repeat two vertices of the segment strip in order to get the orientation correct
  // for the next join. These are wasted vertices, but they enable using a triangle strip. for two joins which
  // might be oriented differently.
  if (iSeg > 1.0 && iSeg <= 3.0) {
    iSeg -= 2.0;
    if (dirB * dirC >= 0.0) iSeg += iSeg == 0.0 ? 1.0 : -1.0;
  }

  vec2 xBasis = tBC;
  vec2 yBasis = nBC * dirB;
  vec2 xy = vec2(0, 1);

  lineCoord.y = dirB * mirrorSign;

  if (iSeg < 0.0) {
    // Draw half of a join
    float m2 = dot(miter, miter);
    float lm = length(miter);
    float tBCm = dot(tBC, miter);
    yBasis = miter / lm;
    bool isBevel = 1.0 > miterLimit * m2;

    if (mod(i, 2.0) == 0.0) {
      // Outer joint points
      if (isRound || isCap) {
        // Round joins
        xBasis = dirB * vec2(yBasis.y, -yBasis.x);
        float cnt = (isCap ? capJoinRes.x : capJoinRes.y) * 2.0;
        float theta = -0.5 * (acos(cosB) * (min(i, cnt) / cnt) - pi) * (isCap ? 2.0 : 1.0);
        xy = vec2(cos(theta), sin(theta));

        if (isCap) {
          if (xy.y > 0.001) xy *= capScale;
          lineCoord.xy = xy.yx * lineCoord.y;
        }
      } else {
        // Miter joins
        yBasis = bIsHairpin ? vec2(0) : miter;
        if (!isBevel) xy.y /= m2;
      }
    } else {
      // Repeat vertex B to create a triangle fan
      lineCoord.y = 0.0;
      xy = vec2(0);

      // Offset the center vertex position to get bevel SDF correct
      if (!isRound && isBevel && !isCap) {
        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);
      }
    }
  //} else if (iSeg == 0.0) { // No op: vertex B + line B-C normal
  } else if (iSeg > 0.0) {
    // vertex B + inner miter
    lineCoord.y = -lineCoord.y;

    float miterExt = 0.0;
    if (cosB > -0.9999) {
      float sinB = tAB.x * tBC.y - tAB.y * tBC.x;
      miterExt = sinB / (1.0 + cosB);
    }
    float m = abs(miterExt);
    m = min(m, min(lBC, lAB) / width);
    xy = vec2(m, -1);
  }

  ${isEndpoints ? `float orientation = ${meta.orientation ? meta.orientation.generate('') : 'mod(orientation,2.0)'};` : ''};
  ${isEndpoints ? `if (orientation == CAP_END) lineCoord.xy = -lineCoord.xy;` : ''}

  vec2 dP = mat2(xBasis, yBasis) * xy;
  float dC = dot(dP, tBC) * mirrorSign;

  float useC = (isMirrored ? 1.0 : 0.0) + dC * (width / lBC);
  lineCoord.z = useC < 0.0 || useC > 1.0 ? 1.0 : 0.0;
  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  gl_Position = pB;
  gl_Position.xy += width * dP;
  gl_Position.xy /= resolution;
  gl_Position *= pw;
}`,
    frag,
    attributes: {
      ...indexAttributes,
      ...spec.attrs
    },
    uniforms: {
      vertexCount: (ctx, props) => computeCount(props),
      capJoinRes: (ctx, props) => [props.capResolution, props.joinResolution],
      miterLimit: (ctx, props) => props.miterLimit * props.miterLimit,
      orientation: regl.prop('orientation'),
      capScale: regl.prop('capScale'),
    },
    primitive: 'triangle strip',
    instances: isEndpoints
      ? (ctx, props) => props.splitCaps ? (props.orientation === ORIENTATION.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2)) : props.count
      : (ctx, props) => props.count - 3,
    count: (ctx, props) => {
      const count = computeCount(props);
      return 6 + 2 * (count[0] + count[1]);
    }
  });

}
