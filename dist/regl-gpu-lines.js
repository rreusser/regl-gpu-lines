(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.reglLines = factory());
})(this, (function () { 'use strict';

  var CAP_START = 0;
  var CAP_END = 1;
  var CAP_SHORT = 2;
  var require$$5 = {
  	CAP_START: CAP_START,
  	CAP_END: CAP_END,
  	CAP_SHORT: CAP_SHORT
  };

  const ORIENTATION$2 = require$$5;
  var drawSegment = createDrawSegmentCommand;

  function createDrawSegmentCommand(regl, isEndpoints, insertCaps, isVAO, meta, frag, segmentSpec, endpointSpec, indexAttributes, forwardedCmdConfig, forwardedUniforms, debug) {
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

    const computeCount = insertCaps ? isEndpoints // Cap has fixed number, join could either be a cap or a join
    ? props => [props.capRes2, Math.max(props.capRes2, props.joinRes2)] // Both could be either a cap or a join
    : props => [Math.max(props.capRes2, props.joinRes2), Math.max(props.capRes2, props.joinRes2)] : isEndpoints // Draw a cap
    ? props => [props.capRes2, props.joinRes2] // Draw two joins
    : props => [props.joinRes2, props.joinRes2];
    return regl({
      // Insert user GLSL at the top
      vert: `${meta.glsl}
const float CAP_START = ${ORIENTATION$2.CAP_START}.0;
const float CAP_END = ${ORIENTATION$2.CAP_END}.0;

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
      uniforms: { ...forwardedUniforms,
        _vertCnt2: (ctx, props) => computeCount(props),
        _capJoinRes2: (ctx, props) => [props.capRes2, props.joinRes2],
        _miterLimit: (ctx, props) => props.miterLimit * props.miterLimit,
        _orientation: regl.prop('orientation'),
        _capScale: regl.prop('capScale'),
        _isRound: (ctx, props) => props.join === 'round',
        _resolution: (ctx, props) => props.viewportSize || [ctx.viewportWidth, ctx.viewportHeight]
      },
      primitive: 'triangle strip',
      instances: isEndpoints ? (ctx, props) => props.splitCaps ? props.orientation === ORIENTATION$2.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2) : props.count : (ctx, props) => props.count - 3,
      count: (ctx, props) => {
        const count = computeCount(props);
        return 6 + (count[0] + count[1]);
      },
      ...forwardedCmdConfig,
      ...vaoProps
    });
  }

  var attrUsage = {
    NONE: 0,
    REGULAR: 1,
    EXTENDED: 2,
    PER_INSTANCE: 4
  };

  const ATTR_USAGE$1 = attrUsage;
  var parsePragmas = parseShaderPragmas$1;
  const PRAGMA_REGEX = /^\s*#pragma\s+lines\s*:\s*([^;]*);?$/i;
  const ATTRIBUTE_REGEX = /^\s*attribute\s+(float|vec2|vec3|vec4)\s+([\w\d_]+)\s*$/i;
  const PROPERTY_REGEX = /^\s*(position|width|orientation)\s+=\s+([\w\d_]+)\s*\(([^)]*)\)\s*$/i;
  const VARYING_REGEX = /^\s*(?:(extrapolate)?)\s*varying\s+(float|vec2|vec3|vec4)\s+([\w\d_]+)\s*=\s*([\w\d_]+)\(([^)]*)\)\s*$/;
  const POSTPROJECT_REGEX = /^\s*postproject\s+=\s+([\w\d_]+)\s*$/i;
  const DIMENSION_GLSL_TYPES = {
    "float": 1,
    "vec2": 2,
    "vec3": 3,
    "vec4": 4
  };

  function parseShaderPragmas$1(glsl) {
    const pragmas = [];
    const lines = glsl.split('\n');

    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(PRAGMA_REGEX, function (match, pragma) {
        pragmas.push(parsePragma(pragma));
        return '';
      });
    }

    return {
      glsl: lines.join('\n').trim(),
      ...analyzePragmas(pragmas)
    };
  }

  function parsePragma(pragma) {
    pragma = pragma.trim();
    let match;

    if (match = pragma.match(ATTRIBUTE_REGEX)) {
      const dimension = DIMENSION_GLSL_TYPES[match[1]];
      const name = match[2];
      return {
        type: 'attribute',
        dimension,
        name
      };
    } else if (match = pragma.match(PROPERTY_REGEX)) {
      const property = match[1];
      const returnType = {
        width: 'float',
        position: 'vec4',
        orientation: 'bool'
      }[property];
      const name = match[2];
      const inputs = match[3].split(',').map(str => str.trim()).filter(x => !!x);

      const generate = (label, prefix) => `${name}(${inputs.map(input => (prefix || '') + input + label).join(', ')})`;

      return {
        type: 'property',
        property,
        returnType,
        name,
        inputs,
        generate
      };
    } else if (match = pragma.match(VARYING_REGEX)) {
      const extrapolate = match[1] === 'extrapolate';
      const returnType = match[2];
      const name = match[3];
      const getter = match[4];
      const inputs = match[5].split(',').map(str => str.trim()).filter(x => !!x);

      const generate = (interp, a, b) => {
        const clamped = extrapolate ? interp : `clamp(${interp},0.0,1.0)`;
        return `${name} = ${getter}(${inputs.map(input => `mix(${input + a}, ${input + b}, ${clamped})`).join(', ')});`;
      };

      return {
        type: 'varying',
        returnType,
        name,
        getter,
        inputs,
        generate
      };
    } else if (match = pragma.match(POSTPROJECT_REGEX)) {
      const name = match[1];
      return {
        type: 'postproject',
        name
      };
    } else {
      throw new Error(`Unrecognized lines pragma: "${pragma}"`);
    }
  }

  function analyzePragmas(pragmas) {
    let postproject;
    const attrs = new Map();
    const varyings = new Map();

    for (const pragma of pragmas) {
      if (pragma.type === 'attribute') {
        attrs.set(pragma.name, pragma);
        pragma.vertexUsage = ATTR_USAGE$1.NONE;
        pragma.endpointUsage = ATTR_USAGE$1.NONE;
      } else if (pragma.type === 'varying') {
        varyings.set(pragma.name, pragma);
      } else if (pragma.type === 'postproject') {
        postproject = pragma.name;
      }
    }

    let width, position, orientation;

    for (const pragma of pragmas) {
      if (pragma.type !== 'property') continue;

      switch (pragma.property) {
        case 'width':
          if (width) throw new Error(`Unexpected duplicate pragma for property "${pragma.property}"`);
          width = pragma;
          break;

        case 'position':
          if (position) throw new Error(`Unexpected duplicate pragma for property "${pragma.property}"`);
          position = pragma;
          break;

        case 'orientation':
          if (orientation) throw new Error(`Unexpected duplicate pragma for property "${pragma.property}"`);
          orientation = pragma;
          break;

        default:
          throw new Error(`Invalid pragma property "${pragma.property}"`);
      }

      for (const input of pragma.inputs) {
        if (!attrs.has(input)) throw new Error(`Missing attribute ${input} of property ${pragma.property}`);
      }
    }

    for (const pragma of pragmas) {
      if (!pragma.inputs) continue;

      for (const input of pragma.inputs) {
        const inputAttr = attrs.get(input);

        if (pragma.type === 'property' || pragma.type === 'varying') {
          if (pragma.property === 'position') {
            inputAttr.vertexUsage |= ATTR_USAGE$1.EXTENDED;
            inputAttr.endpointUsage |= ATTR_USAGE$1.EXTENDED;
          } else if (pragma.property === 'orientation') {
            inputAttr.endpointUsage |= ATTR_USAGE$1.PER_INSTANCE;
          } else {
            inputAttr.endpointUsage |= ATTR_USAGE$1.REGULAR;
            inputAttr.vertexUsage |= ATTR_USAGE$1.REGULAR;
          }
        }
      }
    }

    return {
      varyings,
      attrs,
      width,
      position,
      orientation,
      postproject
    };
  }

  const DTYPES_SIZES = [];
  DTYPES_SIZES[5120] = 1; // int8

  DTYPES_SIZES[5122] = 2; // int16

  DTYPES_SIZES[5124] = 4; // int32

  DTYPES_SIZES[5121] = 1; // uint8

  DTYPES_SIZES[5123] = 2; // uint16

  DTYPES_SIZES[5125] = 4; // uint32

  DTYPES_SIZES[5126] = 4; // float32

  var dtypesizes = DTYPES_SIZES;

  var int8 = 5120;
  var int16 = 5122;
  var int32 = 5124;
  var uint8 = 5121;
  var uint16 = 5123;
  var uint32 = 5125;
  var float = 5126;
  var float32 = 5126;
  var require$$1 = {
  	int8: int8,
  	int16: int16,
  	int32: int32,
  	uint8: uint8,
  	uint16: uint16,
  	uint32: uint32,
  	float: float,
  	float32: float32
  };

  var sanitizeBuffer = sanitizeBufferInput;
  const DTYPE_SIZES = dtypesizes;
  const DTYPES = require$$1;

  function has(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  } // This function is run on every draw call in order to sanitize and configure the data layout


  function sanitizeBufferInput(metadata, buffersObj, isEndpoints) {
    //console.log('metadata:', metadata);
    //console.log('buffersObj:', buffersObj);
    //console.log('isEndpoints:', isEndpoints);
    const outputs = {};
    if (!buffersObj) return outputs;

    for (let [attrName, attrMeta] of metadata.attrs) {
      const input = buffersObj[attrName];
      const usage = isEndpoints ? attrMeta.endpointUsage : attrMeta.vertexUsage;
      if (!usage) continue;
      const output = {
        buffer: null,
        dimension: attrMeta.dimension,
        offset: 0,
        type: NaN,
        stride: NaN,
        divisor: 1,
        bytesPerElement: NaN
      };

      if (!input) {
        throw new Error(`Missing buffer for ${isEndpoints ? 'endpoint' : 'vertex'} attribute '${attrName}'`);
      } else if (input._reglType === 'buffer') {
        output.buffer = input;
        output.type = output.buffer._buffer.dtype;
      } else if (input.buffer._reglType === 'buffer') {
        output.buffer = input.buffer;

        if (has(input, 'dimension') && input.dimension !== output.dimension) {
          throw new Error(`Size of attribute (${input.dimension}) does not match dimension specified in shader pragma (${attrMeta.dimension})`);
        }

        if (has(input, 'offset')) output.offset = input.offset;

        if (has(input, 'type')) {
          output.type = DTYPES[input.type];
        } else {
          output.type = output.buffer._buffer.dtype;
        }

        if (has(input, 'divisor')) {
          output.divisor = input.divisor;
        }

        if (has(input, 'stride')) output.stride = input.stride;
      } else {
        throw new Error(`Invalid buffer for attribute '${attrName}'`);
      }

      output.bytesPerElement = DTYPE_SIZES[output.type];

      if (Number.isNaN(output.stride)) {
        output.stride = output.bytesPerElement * attrMeta.dimension;
      }

      outputs[attrName] = output;
    }

    return outputs;
  }

  const GLSL_TYPES$1 = [];
  GLSL_TYPES$1[1] = 'float';
  GLSL_TYPES$1[2] = 'vec2';
  GLSL_TYPES$1[3] = 'vec3';
  GLSL_TYPES$1[4] = 'vec4';
  var glsltypes = GLSL_TYPES$1;

  var createAttrSpec$1 = createAttrSpecs;
  const ATTR_USAGE = attrUsage;
  const GLSL_TYPES = glsltypes;
  const ORIENTATION$1 = require$$5; // This function returns regl props, used for constructing the attribute layout regl accessors
  // and corresponding GLSL up front.

  function createAttrSpecs(meta, regl, isEndpoints) {
    const suffixes = isEndpoints ? ['B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
    const attrLines = [];
    const attrSpecList = [];
    meta.attrs.forEach((attr, attrName) => {
      const usage = isEndpoints ? attr.endpointUsage : attr.vertexUsage;
      if (!usage) return;
      const attrList = [];

      function emitAttr(index, suffix) {
        const attrOutName = attrName + suffix;
        attrList.push(attrOutName);

        if (isEndpoints) {
          const instanceStride = usage & ATTR_USAGE.PER_INSTANCE ? 1 : 3;
          attrSpecList.push({
            name: attrOutName,
            spec: {
              buffer: (ctx, props) => props.buffers[attrName].buffer,
              offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * ((props.orientation === ORIENTATION$1.CAP_START || !props.splitCaps ? 0 : 3) + index),
              stride: (ctx, props) => props.buffers[attrName].stride * instanceStride * (props.splitCaps ? 2 : 1),
              divisor: (ctx, props) => props.buffers[attrName].divisor
            }
          });
        } else {
          attrSpecList.push({
            name: attrOutName,
            spec: {
              buffer: (ctx, props) => props.buffers[attrName].buffer,
              offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * index,
              stride: (ctx, props) => props.buffers[attrName].stride,
              divisor: (ctx, props) => props.buffers[attrName].divisor
            }
          });
        }
      }

      if (usage & ATTR_USAGE.PER_INSTANCE) {
        emitAttr(0, '');
      }

      if (usage & ATTR_USAGE.REGULAR || usage & ATTR_USAGE.EXTENDED) {
        for (let i = 0; i < suffixes.length; i++) {
          const suffix = suffixes[i];
          if (!(usage & ATTR_USAGE.EXTENDED) && (suffix === 'D' || suffix === 'A')) continue;
          emitAttr(i, suffix);
        }
      }

      attrLines.push(`attribute ${GLSL_TYPES[attr.dimension]} ${attrList.join(', ')};`);
    });
    meta.varyings.forEach((varying, varyingName) => {
      attrLines.push(`varying ${varying.returnType} ${varyingName};`);
    });
    return {
      glsl: attrLines.join('\n'),
      attrs: attrSpecList
    };
  }

  var sanitizeInList = function createSanitizer(label, list, dflt) {
    return function sanitizeValue(value) {
      if (!value) return dflt;

      if (list.indexOf(value) === -1) {
        throw new Error(`Invalid ${label} type. Valid options are: ${list.join(', ')}.`);
      }

      return value;
    };
  };

  const createDrawSegment = drawSegment;
  const parseShaderPragmas = parsePragmas;
  const sanitizeBufferInputs = sanitizeBuffer;
  const createAttrSpec = createAttrSpec$1;
  const sanitizeInclusionInList = sanitizeInList;
  const ORIENTATION = require$$5;
  var src = reglLines;
  reglLines.CAP_START = ORIENTATION.CAP_START;
  reglLines.CAP_END = ORIENTATION.CAP_END;
  const FORBIDDEN_REGL_PROPS = new Set(['attributes', 'elements']);
  const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
  const VALID_CAP_TYPES = ['round', 'square', 'none'];
  const ROUND_CAP_SCALE = [1, 1];
  const SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)]; // Max possible is 62, but we probably don't need that many

  const MAX_ROUND_JOIN_RESOLUTION = 32;
  const MAX_DEBUG_VERTICES = 16384;
  const FEATUREMASK_IS_ENDPOINTS = 1 << 0;
  const FEATUREMASK_INSERT_CAPS = 1 << 1;
  const FEATUREMASK_VAO = 1 << 2;

  function getCacheKey(isEndpoints, insertCaps, isVAO) {
    return (isEndpoints ? FEATUREMASK_IS_ENDPOINTS : 0) + (insertCaps ? FEATUREMASK_INSERT_CAPS : 0) + (isVAO ? FEATUREMASK_VAO : 0);
  }

  function reglLines(regl, opts = {}) {
    const {
      vert = null,
      frag = null,
      debug = false,
      reorder = false
    } = opts;
    if (!regl._gpuLinesCache) regl._gpuLinesCache = {};
    const cache = regl._gpuLinesCache; // Forward all regl parameters except for vert and frag and a couple forbidden parameters along to regl.

    const forwardedCmdConfig = { ...opts
    };
    const forwardedUniforms = opts.uniforms || {};

    for (const prop of ['vert', 'frag', 'debug', 'reorder', 'uniforms']) delete forwardedCmdConfig[prop];

    const forwarded = Object.keys(forwardedCmdConfig);
    forwarded.forEach(fwd => {
      if (FORBIDDEN_REGL_PROPS.has(fwd)) {
        throw new Error(`Invalid parameter '${fwd}'. Parameters ${[...FORBIDDEN_REGL_PROPS].map(p => `'${p}'`).join(', ')} may not be forwarded to regl.`);
      }
    });
    if (!vert) throw new Error('Missing vertex shader, `vert`');
    if (!frag) throw new Error('Missing fragment shader, `frag`');
    const meta = parseShaderPragmas(vert);
    const segmentSpec = createAttrSpec(meta, regl, false);
    const endpointSpec = createAttrSpec(meta, regl, true);
    const indexAttributes = [];

    if (debug) {
      // TODO: Allocate/grow lazily to avoid an arbitrary limit
      if (!cache.debugInstanceIDBuffer) {
        cache.debugInstanceIDBuffer = regl.buffer(new Uint16Array([...Array(MAX_DEBUG_VERTICES).keys()]));
      }

      indexAttributes.push({
        name: 'debugInstanceID',
        spec: {
          buffer: cache.debugInstanceIDBuffer,
          divisor: 1
        }
      });
    }

    if (!cache.indexBuffer) {
      cache.indexBuffer = regl.buffer(new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]));
    }

    indexAttributes.push({
      name: 'index',
      spec: {
        buffer: cache.indexBuffer,
        divisor: 0
      }
    });
    const sanitizeJoinType = sanitizeInclusionInList('join', VALID_JOIN_TYPES, 'miter');
    const sanitizeCapType = sanitizeInclusionInList('cap', VALID_CAP_TYPES, 'square');
    const drawCommands = new Map();

    function getDrawCommand(featureMask) {
      if (!drawCommands.has(featureMask)) {
        drawCommands.set(featureMask, createDrawSegment(regl, featureMask & FEATUREMASK_IS_ENDPOINTS, featureMask & FEATUREMASK_INSERT_CAPS, featureMask & FEATUREMASK_VAO, meta, frag, segmentSpec, endpointSpec, indexAttributes, forwardedCmdConfig, forwardedUniforms, debug));
      }

      return drawCommands.get(featureMask);
    }

    const drawQueue = [];

    function queue(...propsList) {
      drawQueue.push.apply(drawQueue, propsList);
    }

    function flushDrawQueue() {
      // Sort by the identifier of the draw command so group together commands using the same shader
      if (reorder) drawQueue.sort(function (a, b) {
        return a.featureMask - b.featureMask;
      });
      let pos = 0;
      const groupedProps = []; // Iterate through the queue. Group props until the command changes, then draw and continue

      while (pos < drawQueue.length) {
        const {
          featureMask,
          props
        } = drawQueue[pos];
        groupedProps.push(props);

        while (++pos < drawQueue.length && drawQueue[pos].featureMask === featureMask) {
          groupedProps.push(drawQueue[pos].props);
        } // console.log('isEndpoints:', !!(FEATUREMASK_IS_ENDPOINTS & featureMask), 'insertCaps:', !!(FEATUREMASK_INSERT_CAPS & featureMask), 'batching:', groupedProps.length);


        getDrawCommand(featureMask)(groupedProps);
        groupedProps.length = 0;
      }

      drawQueue.length = 0;
    }

    const returnValue = function drawLines(props) {
      if (!props) return;
      if (!Array.isArray(props)) props = [props];

      for (const userProps of props) {
        const join = sanitizeJoinType(userProps.join);
        const cap = sanitizeCapType(userProps.cap);
        const isVAO = !!userProps.vao;
        let capRes2 = userProps.capResolution === undefined ? 12 : userProps.capResolution;

        if (cap === 'square') {
          capRes2 = 3;
        } else if (cap === 'none') {
          capRes2 = 1;
        }

        let joinRes2 = 1;

        if (join === 'round') {
          joinRes2 = userProps.joinResolution === undefined ? 8 : userProps.joinResolution;
        } // We only ever use these in doubled-up form


        capRes2 *= 2;
        joinRes2 *= 2;
        const miterLimit = join === 'bevel' ? 1 : userProps.miterLimit === undefined ? 4 : userProps.miterLimit;
        const capScale = cap === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;
        const insertCaps = !!userProps.insertCaps;
        const sharedProps = {
          joinRes2,
          capRes2,
          capScale,
          join,
          miterLimit,
          insertCaps
        };

        if (userProps.endpointCount) {
          const endpointProps = {
            count: userProps.endpointCount,
            ...userProps,
            ...sharedProps
          };
          let featureMask = getCacheKey(true, insertCaps, isVAO);

          if (isVAO) {
            if (meta.orientation) {
              const vao = {
                vao: endpointProps.vao.endpoints
              };
              queue({
                featureMask,
                props: { ...endpointProps,
                  ...vao
                }
              });
            } else {
              const startVao = {
                vao: endpointProps.vao.startCaps
              };
              const endVao = {
                vao: endpointProps.vao.endCaps
              };
              queue({
                featureMask,
                props: { ...endpointProps,
                  ...startVao,
                  orientation: ORIENTATION.CAP_START,
                  splitCaps: true
                }
              }, {
                featureMask,
                props: { ...endpointProps,
                  ...endVao,
                  orientation: ORIENTATION.CAP_END,
                  splitCaps: true
                }
              });
            }
          } else {
            endpointProps.buffers = sanitizeBufferInputs(meta, userProps.endpointAttributes, true);

            if (meta.orientation) {
              queue({
                featureMask,
                props: { ...endpointProps,
                  splitCaps: false
                }
              });
            } else {
              queue({
                featureMask,
                props: { ...endpointProps,
                  orientation: ORIENTATION.CAP_START,
                  splitCaps: true
                }
              }, {
                featureMask,
                props: { ...endpointProps,
                  orientation: ORIENTATION.CAP_END,
                  splitCaps: true
                }
              });
            }
          }
        }

        if (userProps.vertexCount) {
          const featureMask = getCacheKey(false, insertCaps, isVAO);
          const props = {
            count: userProps.vertexCount,
            ...userProps,
            ...sharedProps
          };

          if (isVAO) {
            props.vao = userProps.vao.vertices;
          } else {
            props.buffers = sanitizeBufferInputs(meta, userProps.vertexAttributes, false);
          }

          queue({
            featureMask,
            props
          });
        }

        flushDrawQueue();
      }
    };

    returnValue.vao = function (props) {
      const outputs = {};
      const cases = [['vertices', segmentSpec.attrs, props.vertexAttributes, false]];

      if (meta.orientation) {
        cases.push(['endpoints', endpointSpec.attrs, props.endpointAttributes, true, false, null]);
      } else {
        cases.push(['startCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_START], ['endCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_END]);
      }

      for (const [outputName, specAttrs, attrs, isEndpoints, splitCaps, orientation] of cases) {
        if (!attrs) continue;
        const fakeProps = {
          buffers: sanitizeBufferInputs(meta, attrs, isEndpoints),
          splitCaps,
          orientation
        };
        const vaoData = [];

        for (const attr of indexAttributes.concat(specAttrs)) {
          const vaoEntry = {};

          for (const item of ['buffer', 'divisor', 'offset', 'stride', 'normalized', 'dimension']) {
            let value = attr.spec[item];
            if (value && value.data) value = value.data;
            if (typeof value === 'function') value = value({}, fakeProps);
            if (value !== undefined) vaoEntry[item] = value;
          }

          vaoData.push(vaoEntry);
        }

        outputs[outputName] = regl.vao(vaoData);
      }

      outputs.destroy = function destroy() {
        for (const [outputName] of cases) {
          if (!outputs[outputName]) continue;
          outputs[outputName].destroy();
          delete outputs[outputName];
        }
      };

      return outputs;
    };

    return returnValue;
  }

  return src;

}));
