'use strict';

const ORIENTATION = require('./constants/orientation.json');

module.exports = createDrawSegmentCommand;

function createDrawSegmentCommand(
  regl,
  isEndpoints,
  insertCaps,
  isVAO,
  meta,
  frag,
  segmentSpec,
  endpointSpec,
  indexAttributes,
  forwardedCmdConfig,
  forwardedUniforms,
  debug
) {
  const spec = isEndpoints ? endpointSpec : segmentSpec;
  const verts = ['B', 'C', 'D'];
  if (!isEndpoints) verts.unshift('A');

  const attributes = {};
  const vaoProps = {};
  const attrList = indexAttributes.concat(spec.attrs);
  if (isVAO) {
    vaoProps.vao = regl.prop('vao');
    for (let i = 0; i < attrList.length; i++) {
      attributes[attrList[i].name] = i;
    }
  } else {
    for (const attr of attrList) {
      attributes[attr.name] = attr.spec;
    }
  }

  const computeCount = insertCaps
    ? isEndpoints
      // Cap has fixed number, join could either be a cap or a join
      ? props => [props.capRes2, Math.max(props.capRes2, props.joinRes2)]
      // Both could be either a cap or a join
      : props => [Math.max(props.capRes2, props.joinRes2), Math.max(props.capRes2, props.joinRes2)]
    : isEndpoints
      // Draw a cap
      ? props => [props.capRes2, props.joinRes2]
      // Draw two joins
      : props => [props.joinRes2, props.joinRes2];

  return regl({
    // Insert user GLSL at the top
    vert: `${meta.glsl}
const float CAP_START = ${ORIENTATION.CAP_START}.0;
const float CAP_END = ${ORIENTATION.CAP_END}.0;

// Attribute specification
${spec.glsl}

attribute float index;
${debug ? 'attribute float debugInstanceID;' : ''}

uniform bool _isRound;
uniform vec2 _vertCnt2, _capJoinRes2;
uniform vec2 _resolution, _capScale;
uniform float _miterLimit;
${meta.orientation || !isEndpoints ? '' : 'uniform float _orientation;'}

varying vec3 lineCoord;
${debug ? 'varying vec2 triStripCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}
${debug ? 'varying float vertexIndex;' : ''}

// This turns out not to work very well
bool isnan(float val) {
  return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;
}

bool invalid(vec4 p) {
  return p.w == 0.0 || isnan(p.x);
}

void main() {
  const float pi = 3.141592653589793;

  ${debug ? 'vertexIndex = index;' : ''}
  lineCoord = vec3(0);

  ${debug ? `instanceID = ${isEndpoints ? '-1.0' : 'debugInstanceID'};` : ''}
  ${debug ? 'triStripCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}

  ${verts.map(vert => `vec4 p${vert} = ${meta.position.generate(vert)};`).join('\n')}

  // A sensible default for early returns
  gl_Position = pB;

  bool aInvalid = ${isEndpoints ? 'false' : 'invalid(pA)'};
  bool bInvalid = invalid(pB);
  bool cInvalid = invalid(pC);
  bool dInvalid = invalid(pD);

  // Vertex count for each part (first half of join, second (mirrored) half). Note that not all of
  // these vertices may be used, for example if we have enough for a round cap but only draw a miter
  // join.
  vec2 v = _vertCnt2 + 3.0;

  // Total vertex count
  float N = dot(v, vec2(1));

  // If we're past the first half-join and half of the segment, then we swap all vertices and start
  // over from the opposite end.
  bool mirror = index >= v.x;

  // When rendering dedicated endoints, this allows us to insert an end cap *alone* (without the attached
  // segment and join)
  ${isEndpoints ? `if (dInvalid && mirror) return;` : ''}

  // Convert to screen-pixel coordinates
  // Save w so we can perspective re-multiply at the end to get varyings depth-correct
  float pw = mirror ? pC.w : pB.w;
  ${verts.map(v => `p${v} = vec4(vec3(p${v}.xy * _resolution, p${v}.z) / p${v}.w, 1);`).join('\n')}

  // If it's a cap, mirror A back onto C to accomplish a round
  ${isEndpoints ? `vec4 pA = pC;` : ''}

  // Reject if invalid or if outside viewing planes
  if (bInvalid || cInvalid || max(abs(pB.z), abs(pC.z)) > 1.0) return;

  // Swap everything computed so far if computing mirrored half
  if (mirror) {
    vec4 vTmp = pC; pC = pB; pB = vTmp;
    vTmp = pD; pD = pA; pA = vTmp;
    bool bTmp = dInvalid; dInvalid = aInvalid; aInvalid = bTmp;
  }

  ${isEndpoints ? `bool isCap = !mirror;` : `${insertCaps ? '' : 'const '}bool isCap = false`};

  // Either flip A onto C (and D onto B) to produce a 180 degree-turn cap, or extrapolate to produce a
  // degenerate (no turn) join, depending on whether we're inserting caps or just leaving ends hanging.
  if (aInvalid) { ${insertCaps ? 'pA = pC; isCap = true;' : 'pA = 2.0 * pB - pC;'} }
  if (dInvalid) { ${insertCaps ? 'pD = pB;' : 'pD = 2.0 * pC - pB;'} }
  bool roundOrCap = _isRound || isCap;

  // TODO: swap inputs rather than computing both and discarding one
  float width = mirror ? ${meta.width.generate('C')} : ${meta.width.generate('B')};

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

  // Clamp for safety, since we take the arccos
  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  // This section is somewhat fragile. When lines are collinear, signs flip randomly and break orientation
  // of the middle segment. The fix appears straightforward, but this took a few hours to get right.
  const float tol = 1e-4;
  float mirrorSign = mirror ? -1.0 : 1.0;
  float dirB = -dot(tBC, nAB);
  float dirC = dot(tBC, nCD);
  bool bCollinear = abs(dirB) < tol;
  bool cCollinear = abs(dirC) < tol;
  bool bIsHairpin = bCollinear && cosB < 0.0;
  // bool cIsHairpin = cCollinear && dot(tBC, tCD) < 0.0;
  dirB = bCollinear ? -mirrorSign : sign(dirB);
  dirC = cCollinear ? -mirrorSign : sign(dirC);

  vec2 miter = bIsHairpin ? -tBC : 0.5 * (nAB + nBC) * dirB;

  // Compute our primary "join index", that is, the index starting at the very first point of the join.
  // The second half of the triangle strip instance is just the first, reversed, and with vertices swapped!
  float i = mirror ? N - index : index;

  // Decide the resolution of whichever feature we're drawing. n is twice the number of points used since
  // that's the only form in which we use this number.
  float res = (isCap ? _capJoinRes2.x : _capJoinRes2.y);

  // Shift the index to send unused vertices to an index below zero, which will then just get clamped to
  // zero and result in repeated points, i.e. degenerate triangles.
  i -= max(0.0, (mirror ? _vertCnt2.y : _vertCnt2.x) - res);

  // Use the direction to offset the index by one. This has the effect of flipping the winding number so
  // that it's always consistent no matter which direction the join turns.
  i += (dirB < 0.0 ? -1.0 : 0.0);

  // Vertices of the second (mirrored) half of the join are offset by one to get it to connect correctly
  // in the middle, where the mirrored and unmirrored halves meet.
  i -= mirror ? 1.0 : 0.0;

  // Clamp to zero and repeat unused excess vertices.
  i = max(0.0, i);

  // Start with a default basis pointing along the segment with normal vector outward
  vec2 xBasis = tBC;
  vec2 yBasis = nBC * dirB;

  // Default point is 0 along the segment, 1 (width unit) normal to it
  vec2 xy = vec2(0);

  lineCoord.y = dirB * mirrorSign;

  if (i == res + 1.0) {
    // pick off this one specific index to be the interior miter point
    // If not div-by-zero, then sinB / (1 + cosB)
    float m = cosB > -0.9999 ? (tAB.x * tBC.y - tAB.y * tBC.x) / (1.0 + cosB) : 0.0;
    xy = vec2(min(abs(m), min(lBC, lAB) / width), -1);
    lineCoord.y = -lineCoord.y;
  } else {
    // Draw half of a join
    float m2 = dot(miter, miter);
    float lm = sqrt(m2);
    yBasis = miter / lm;
    xBasis = dirB * vec2(yBasis.y, -yBasis.x);
    bool isBevel = 1.0 > _miterLimit * m2;

    if (mod(i, 2.0) == 0.0) {
      // Outer joint points
      if (roundOrCap || i != 0.0) {
        // Round joins
        float theta = -0.5 * (acos(cosB) * (clamp(i, 0.0, res) / res) - pi) * (isCap ? 2.0 : 1.0);
        xy = vec2(cos(theta), sin(theta));

        if (isCap) {
          // A special multiplier factor for turning 3-point rounds into square caps (but leave the
          // y == 0.0 point unaffected)
          if (xy.y > 0.001) xy *= _capScale;
          lineCoord.xy = xy.yx * lineCoord.y;
        }
      } else {
        // Miter joins
        yBasis = bIsHairpin ? vec2(0) : miter;
        xy.y = isBevel ? 1.0 : 1.0 / m2;
      }
    } else {
      // Center of the fan
      lineCoord.y = 0.0;

      // Offset the center vertex position to get bevel SDF correct
      if (isBevel && !roundOrCap) {
        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);
      }
    }
  }

  ${isEndpoints ? `float _orientation = ${meta.orientation ? meta.orientation.generate('') : 'mod(_orientation,2.0)'};` : ''};

  // Since we can't know the orientation of end caps without being told. This comes either from
  // input via the orientation property or from a uniform, assuming caps are interleaved (start,
  // end, start, end, etc.) and rendered in two passes: first starts, then ends.
  ${isEndpoints ? `if (_orientation == CAP_END) lineCoord.xy = -lineCoord.xy;` : ''}

  // Point offset from main vertex position
  vec2 dP = mat2(xBasis, yBasis) * xy;

  // Dot with the tangent to account for dashes. Note that by putting this in *one place*, dashes
  // should always be correct without having to compute a unique correction for every point.
  float dx = dot(dP, tBC) * mirrorSign;

  // Interpolant: zero for using B, 1 for using C
  float useC = (mirror ? 1.0 : 0.0) + dx * (width / lBC);

  lineCoord.z = useC < 0.0 || useC > 1.0 ? 1.0 : 0.0;

  // The varying generation code handles clamping, if needed
  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  gl_Position = pB;
  gl_Position.xy += width * dP;
  gl_Position.xy /= _resolution;
  gl_Position *= pw;
  ${meta.postproject ? `gl_Position = ${meta.postproject}(gl_Position);` : ''}
}`,
    frag,
    attributes,
    uniforms: {
      ...forwardedUniforms,
      _vertCnt2: (ctx, props) => computeCount(props),
      _capJoinRes2: (ctx, props) => [props.capRes2, props.joinRes2],
      _miterLimit: (ctx, props) => props.miterLimit * props.miterLimit,
      _orientation: regl.prop('orientation'),
      _capScale: regl.prop('capScale'),
      _isRound: (ctx, props) => props.join === 'round',
      _resolution: (ctx, props) => props.viewportSize || [ctx.viewportWidth, ctx.viewportHeight],
    },
    primitive: 'triangle strip',
    instances: isEndpoints
      ? (ctx, props) => props.splitCaps ? (props.orientation === ORIENTATION.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2)) : props.count
      : (ctx, props) => props.count - 3,
    count: (ctx, props) => {
      const count = computeCount(props);
      return 6 + (count[0] + count[1]);
    },
    ...forwardedCmdConfig,
    ...vaoProps
  });
}
