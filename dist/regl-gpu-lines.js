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

  function createDrawSegmentCommand(isRound, isEndpoints, {
    regl,
    meta,
    frag,
    segmentSpec,
    endpointSpec,
    indexAttributes,
    insertCaps,
    debug
  }) {
    const spec = isEndpoints ? endpointSpec : segmentSpec;
    const verts = ['B', 'C', 'D'];
    if (!isEndpoints) verts.unshift('A');

    function computeCount(props) {
      return insertCaps ? isEndpoints // Cap has fixed number, join could either be a cap or a join
      ? [props.capResolution, Math.max(props.capResolution, props.joinResolution)] // Both could be either a cap or a join
      : [Math.max(props.capResolution, props.joinResolution), Math.max(props.capResolution, props.joinResolution)] : isEndpoints // Draw a cap
      ? [props.capResolution, props.joinResolution] // Draw two joins
      : [props.joinResolution, props.joinResolution];
    }

    return regl({
      vert: `${meta.glsl}
const float CAP_START = ${ORIENTATION$2.CAP_START}.0;
const float CAP_END = ${ORIENTATION$2.CAP_END}.0;

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
      attributes: { ...indexAttributes,
        ...spec.attrs
      },
      uniforms: {
        vertexCount: (ctx, props) => computeCount(props),
        capJoinRes: (ctx, props) => [props.capResolution, props.joinResolution],
        miterLimit: (ctx, props) => props.miterLimit * props.miterLimit,
        orientation: regl.prop('orientation'),
        capScale: regl.prop('capScale')
      },
      primitive: 'triangle strip',
      instances: isEndpoints ? (ctx, props) => props.splitCaps ? props.orientation === ORIENTATION$2.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2) : props.count : (ctx, props) => props.count - 3,
      count: (ctx, props) => {
        const count = computeCount(props);
        return 6 + 2 * (count[0] + count[1]);
      }
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
    } else {
      throw new Error(`Unrecognized lines pragma: "${pragma}"`);
    }
  }

  function analyzePragmas(pragmas) {
    const attrs = new Map();
    const varyings = new Map();

    for (const pragma of pragmas) {
      if (pragma.type === 'attribute') {
        attrs.set(pragma.name, pragma);
        pragma.vertexUsage = ATTR_USAGE$1.NONE;
        pragma.endpointUsage = ATTR_USAGE$1.NONE;
      } else if (pragma.type === 'varying') {
        varyings.set(pragma.name, pragma);
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
      orientation
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
    const attrSpecs = {};
    meta.attrs.forEach((attr, attrName) => {
      const usage = isEndpoints ? attr.endpointUsage : attr.vertexUsage;
      if (!usage) return;
      const attrList = [];

      function emitAttr(index, suffix) {
        const attrOutName = attrName + suffix;
        attrList.push(attrOutName);

        if (isEndpoints) {
          const instanceStride = usage & ATTR_USAGE.PER_INSTANCE ? 1 : 3;
          attrSpecs[attrOutName] = {
            buffer: regl.prop(`buffers.${attrName}.buffer`),
            offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * ((props.orientation === ORIENTATION$1.CAP_START || !props.splitCaps ? 0 : 3) + index),
            stride: (ctx, props) => props.buffers[attrName].stride * instanceStride * (props.splitCaps ? 2 : 1),
            divisor: (ctx, props) => props.buffers[attrName].divisor
          };
        } else {
          attrSpecs[attrOutName] = {
            buffer: regl.prop(`buffers.${attrName}.buffer`),
            offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * index,
            stride: (ctx, props) => props.buffers[attrName].stride,
            divisor: (ctx, props) => props.buffers[attrName].divisor
          };
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
      attrs: attrSpecs
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
  const FORBIDDEN_REGL_PROPS = new Set(['count', 'instances', 'attributes', 'elements']);
  const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
  const VALID_CAP_TYPES = ['round', 'square', 'none'];
  const ROUND_CAP_SCALE = [1, 1];
  const SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)];
  const MAX_ROUND_JOIN_RESOLUTION = 30;
  const MAX_DEBUG_VERTICES = 16384;

  function reglLines(regl, opts = {}) {
    const {
      vert = null,
      frag = null,
      debug = false,
      insertCaps = false
    } = opts; // Forward all regl parameters except for vert and frag along to regl.

    const forwardedCmdConfig = { ...opts
    };

    for (const prop of ['vert', 'frag', 'debug', 'insertCaps']) delete forwardedCmdConfig[prop];

    const forwarded = Object.keys(forwardedCmdConfig);
    const canReorder = forwarded.length === 0;
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
    const setResolution = regl({
      uniforms: {
        resolution: ctx => [ctx.viewportWidth, ctx.viewportHeight]
      }
    });
    const userConfig = canReorder ? (props, cb) => cb() : regl(forwardedCmdConfig);
    const indexAttributes = {};

    if (debug) {
      // TODO: Allocate/grow lazily to avoid an arbitrary limit
      indexAttributes.debugInstanceID = {
        buffer: regl.buffer(new Uint16Array([...Array(MAX_DEBUG_VERTICES).keys()])),
        divisor: 1
      };
    }

    indexAttributes.index = {
      buffer: regl.buffer(new Int8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 6 + 4).keys()])),
      divisor: 0
    }; // Instantiate commands

    const config = {
      regl,
      meta,
      segmentSpec,
      endpointSpec,
      frag,
      indexAttributes,
      debug,
      insertCaps
    };
    const drawMiterSegment = createDrawSegment(false, false, config);
    const drawRoundedSegment = createDrawSegment(true, false, config);
    const drawMiterCap = createDrawSegment(false, true, config);
    const drawRoundedCap = createDrawSegment(true, true, config);
    const sanitizeJoinType = sanitizeInclusionInList('join', VALID_JOIN_TYPES, 'miter');
    const sanitizeCapType = sanitizeInclusionInList('cap', VALID_CAP_TYPES, 'square');
    const allRoundedSegments = [];
    const allRoundedCaps = [];
    const allMiterSegments = [];
    const allMiterCaps = [];

    function flush(props) {
      userConfig(props, () => {
        if (allRoundedSegments.length) drawRoundedSegment(allRoundedSegments);
        if (allMiterSegments.length) drawMiterSegment(allMiterSegments);
        if (allRoundedCaps.length) drawRoundedCap(allRoundedCaps);
        if (allMiterCaps.length) drawMiterCap(allMiterCaps);
        allRoundedSegments.length = 0;
        allMiterSegments.length = 0;
        allRoundedCaps.length = 0;
        allMiterCaps.length = 0;
      });
    }

    return function drawLines(props) {
      if (!props) return;
      const isArrayProps = Array.isArray(props);
      if (!isArrayProps) props = [props];
      const reorder = canReorder && !isArrayProps;
      setResolution(() => {
        for (const lineProps of props) {
          const joinType = sanitizeJoinType(lineProps.join);
          const capType = sanitizeCapType(lineProps.cap);
          let capResolution = lineProps.capResolution === undefined ? 12 : lineProps.capResolution;

          if (capType === 'square') {
            capResolution = 3;
          } else if (capType === 'none') {
            capResolution = 1;
          }

          let joinResolution = 1;
          if (joinType === 'round') joinResolution = lineProps.joinResolution === undefined ? 8 : lineProps.joinResolution;
          const miterLimit = joinType === 'bevel' ? 1 : lineProps.miterLimit === undefined ? 4 : lineProps.miterLimit;
          const capScale = capType === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;
          const sharedProps = {
            joinResolution,
            capResolution,
            capScale,
            capType,
            miterLimit
          };

          if (lineProps.endpointAttributes && lineProps.endpointCount) {
            const endpointProps = {
              buffers: sanitizeBufferInputs(meta, lineProps.endpointAttributes, true),
              count: lineProps.endpointCount,
              ...sharedProps
            };
            const endpointDst = joinType === 'round' ? allRoundedCaps : allMiterCaps;

            if (meta.orientation) {
              endpointDst.push({ ...endpointProps,
                splitCaps: false
              });
            } else {
              endpointDst.push({ ...endpointProps,
                orientation: ORIENTATION.CAP_START,
                splitCaps: true
              }, { ...endpointProps,
                orientation: ORIENTATION.CAP_END,
                splitCaps: true
              });
            }
          }

          if (lineProps.vertexAttributes && lineProps.vertexCount) {
            const segmentDst = joinType === 'round' ? allRoundedSegments : allMiterSegments;
            segmentDst.push({
              buffers: sanitizeBufferInputs(meta, lineProps.vertexAttributes, false),
              count: lineProps.vertexCount,
              ...sharedProps
            });
          }

          if (!reorder) flush(lineProps);
        }

        if (reorder) flush(props);
      });
    };
  }

  return src;

}));
