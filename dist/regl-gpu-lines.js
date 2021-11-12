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

  function createDrawSegmentCommand(isRound, isCap, {
    regl,
    meta,
    frag,
    segmentSpec,
    endpointSpec,
    indexAttributes,
    debug
  }) {
    const spec = isCap ? endpointSpec : segmentSpec;
    const verts = ['B', 'C', 'D'];
    if (!isCap) verts.unshift('A');
    return regl({
      vert: `${meta.glsl}

const float CAP_START = ${ORIENTATION$2.CAP_START}.0;
const float CAP_END = ${ORIENTATION$2.CAP_END}.0;

attribute float index;
${spec.glsl}

uniform vec2 joinRes;
uniform vec2 resolution;
uniform float miterLimit2;
${meta.orientation || !isCap ? '' : 'uniform float uOrientation;'}
${isCap ? 'uniform vec2 capScale;' : ''}

varying vec2 lineCoord;

${debug ? 'attribute float debugInstanceID;' : ''}
${debug ? 'varying vec2 triStripCoord;' : ''}
${debug ? 'varying float instanceID;' : ''}

bool isnan(float val) {
  return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;
}

bool invalid(vec4 p) {
  return p.w == 0.0 || isnan(p.x);
}

void main() {
  const bool useRound = ${isRound ? 'true' : 'false'};
  float useC = 0.0;
  lineCoord = vec2(0);

  ${debug ? `instanceID = ${isCap ? '-1.0' : 'debugInstanceID'};` : ''}
  ${debug ? 'triStripCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : ''}

  ${isCap ? `float orientation = ${meta.orientation ? meta.orientation.generate('') : 'mod(uOrientation,2.0)'};` : ''};

  ${verts.map(vert => `vec4 p${vert} = ${meta.position.generate(vert)};`).join('\n')}

  // Check for invalid vertices
  if (${verts.map(vert => `invalid(p${vert})`).join(' || ')}) {
    gl_Position = vec4(0);
    return;
  }

  bool isMirrored = index > joinRes.x * 2.0 + 3.0;

  // Convert to screen-pixel coordinates
  float w = isMirrored ? pC.w : pB.w;
  ${verts.map(v => `p${v} = vec4(vec3(p${v}.xy * resolution, p${v}.z) / p${v}.w, 1);`).join('\n')}

  // If it's a cap, mirror A back onto C to accomplish a round
  ${isCap ? `vec4 pA = pC;` : ''}

  vec2 res = isMirrored ? joinRes.yx : joinRes;
  float mirrorSign = isMirrored ? -1.0 : 1.0;
  if (isMirrored) {
    vec4 tmp;
    tmp = pC; pC = pB; pB = tmp;
    tmp = pD; pD = pA; pA = tmp;
    useC = 1.0;
  }
  ${isCap ? `bool isCap = !isMirrored;` : `const bool isCap = false;`};

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
  tAB /= lAB;
  vec2 nAB = vec2(-tAB.y, tAB.x);

  vec2 rCD = pD.xy - pC.xy;
  float lCD = length(rCD);
  vec2 tCD = rCD / lCD;
  vec2 nCD = vec2(-tCD.y, tCD.x);

  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);

  // This section is very fragile. When lines are collinear, signs flip randomly and break orientation
  // of the middle segment. So we detect and fix three different cases (b collinear, c collinear, b and
  // c collinear).
  const float tol = 1e-3;
  float sgnB = dot(tAB, nBC);
  float sgnC = dot(tBC, nCD);
  float dirB = sign(sgnB);
  float dirC = sign(sgnC);
  bool bCollinear = abs(sgnB) < tol;
  bool cCollinear = abs(sgnC) < tol;
  if (bCollinear && cCollinear) {
    // When both collinear, assign signs arbitrarily
    dirB = 1.0;
    dirC = -1.0;
  } else if (bCollinear) {
    // When only B collinear, assign its sign based on C
    dirB = dirC;
  } else if (cCollinear) {
    // When only C collinear, assign its sign from B
    dirC = dirB;
  }

  // Override the miter for segments which perfectly fold back on themselves
  vec2 miter = 0.5 * (nAB + nBC) * dirB;
  bool isHairpin = bCollinear && cosB < 0.0;
  if (isHairpin) {
    miter = -tBC;
    cosB = -1.0;
  }

  // The second half of the triangle fan is just the first, reversed, and with vertices swapped!
  float i = index < 2.0 * joinRes.x + 4.0 ? index : 2.0 * (res.x + res.y) + 5.0 - index;

  // Chop off the join to get at the segment part index
  float iSeg = i - 2.0 * res.x;

  // Repeat vertices, and if the joins turn opposite directions, swap vertices to get the triangle fan correct
  if (iSeg > 1.0 && iSeg <= 3.0) {
    iSeg -= 2.0;
    if (dirB * dirC >= 0.0) iSeg += iSeg == 0.0 ? 1.0 : -1.0;
  }

  vec2 xBasis = tBC;
  vec2 yBasis = nBC * dirB;
  vec2 xy = vec2(0, 1);

  lineCoord.y = dirB * mirrorSign;

  float dC = 0.0;
  if (iSeg < 0.0) {
    float m2 = dot(miter, miter);
    float lm = length(miter);
    yBasis = miter / lm;
    bool isBevel = 1.0 > miterLimit2 * m2;

    if (mod(i, 2.0) == 0.0) {
      // Outer joint points
      if (useRound || isCap) {
        xBasis = dirB * vec2(yBasis.y, -yBasis.x);
        const float pi = 3.141592653589793;
        float theta = -0.5 * (0.5 * acos(cosB) * (i / res.x) - pi) * (isCap ? 2.0 : 1.0);
        xy = vec2(cos(theta), sin(theta));
        ${isCap ? `if (isCap && xy.y > 0.0) xy *= capScale;` : ''}
        ${isCap ? `if (isCap) lineCoord = xy.yx * lineCoord.y;` : ''}
      } else {
        yBasis = isHairpin ? vec2(0) : miter;
        if (!isBevel) xy.y /= m2;
        dC += dot(tBC * mirrorSign, miter);
      }
    } else {
      // vertex B
      lineCoord.y = 0.0;
      xy = vec2(0);
      if (!useRound && isBevel && !isCap) {
        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);
        dC += dot(tBC * mirrorSign, miter / lm) * xy.y;
      }
    }
  //} else if (iSeg == 0.0) { // vertex B + line B-C normal
  } else if (iSeg > 0.0) {
    lineCoord.y = -lineCoord.y;

    // vertex B + inner miter
    float miterExt = 0.0;
    if (cosB > -0.9999) {
      float sinB = tAB.x * tBC.y - tAB.y * tBC.x;
      miterExt = sinB / (1.0 + cosB);
    }
    float m = abs(miterExt) * width;
    m = min(m, min(lBC, lAB));
    xy = vec2(m / width, -1);
    dC += xy.x * mirrorSign;
  }

  ${isCap ? `if (orientation == CAP_END) lineCoord = -lineCoord;` : ''}

  useC += dC * (width / lBC);
  ${[...meta.varyings.values()].map(varying => varying.generate('useC', 'B', 'C')).join('\n')}

  gl_Position = pB;
  gl_Position.xy += width * (mat2(xBasis, yBasis) * xy);
  gl_Position.xy /= resolution;
  gl_Position *= w;
}`,
      frag,
      attributes: { ...indexAttributes,
        ...spec.attrs
      },
      uniforms: {
        joinRes: (ctx, props) => [isCap ? props.capResolution : props.joinResolution, props.joinResolution],
        miterLimit2: (ctx, props) => props.miterLimit * props.miterLimit,
        uOrientation: regl.prop('orientation'),
        capScale: regl.prop('capScale')
      },
      primitive: 'triangle strip',
      instances: isCap ? (ctx, props) => props.splitCaps ? props.orientation === ORIENTATION$2.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2) : props.count : (ctx, props) => props.count - 3,
      count: isRound ? (ctx, props) => 6 + 2 * (props.joinResolution + (isCap ? props.capResolution : props.joinResolution)) : (ctx, props) => 6 + 2 * (1 + (isCap ? props.capResolution : 1))
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
  const VARYING_REGEX = /^\s*varying\s+(float|vec2|vec3|vec4)\s+([\w\d_]+)\s*=\s*([\w\d_]+)\(([^)]*)\)\s*$/;
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
      const returnType = match[1];
      const name = match[2];
      const getter = match[3];
      const inputs = match[4].split(',').map(str => str.trim()).filter(x => !!x);

      const generate = (interp, a, b) => {
        return `${name} = ${getter}(${inputs.map(input => `mix(${input + a}, ${input + b}, ${interp})`).join(', ')});`;
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
  }

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
  const ORIENTATION$1 = require$$5;

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

  var sanitizeInList = function sanitizeInclusionInList(value, dflt, list, label) {
    if (!value) return dflt;

    if (list.indexOf(value) === -1) {
      throw new Error(`Invalid ${label} type. Options are ${JSON.stringify(list).join(', ')}.`);
    }

    return value;
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
  const FORBIDDEN_PROPS = new Set(['count', 'instances', 'attributes', 'elements']);

  function reglLines(regl, opts = {}) {
    const {
      vert = null,
      frag = null,
      debug = false
    } = opts; // Forward all regl parameters except for vert and frag along to regl. Additionally,
    // extract uniform separately so that we can merge them with the resolution uniform

    const forwardedOpts = { ...opts
    };

    for (const prop of ['vert', 'frag', 'debug']) delete forwardedOpts[prop];

    const forwarded = Object.keys(forwardedOpts);
    const canReorder = forwarded.length === 0;
    forwarded.forEach(fwd => {
      if (FORBIDDEN_PROPS.has(fwd)) {
        throw new Error(`Invalid parameter '${fwd}'. Parameters ${[...FORBIDDEN_PROPS].map(p => `'${p}'`).join(', ')} may not be forwarded to regl.`);
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
    const userConfig = canReorder ? (props, cb) => cb() : regl(forwardedOpts);
    const MAX_ROUND_JOIN_RESOLUTION = 30;
    const indexAttributes = {};

    if (debug) {
      // TODO: Allocate/grow lazily to avoid an arbitrary limit
      const MAX_DEBUG_VERTICES = 16384;
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
      debug
    };
    const drawMiterSegment = createDrawSegment(false, false, config);
    const drawRoundedSegment = createDrawSegment(true, false, config);
    const drawMiterCap = createDrawSegment(false, true, config);
    const drawRoundedCap = createDrawSegment(true, true, config);
    const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
    const VALID_CAP_TYPES = ['round', 'square', 'none'];
    const ROUND_CAP_SCALE = [1, 1];
    const SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)];
    return function drawLines(props) {
      if (!props) return;
      const isArrayProps = Array.isArray(props);
      if (!isArrayProps) props = [props];
      const reorder = canReorder && !isArrayProps;
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

      setResolution(() => {
        for (const lineProps of props) {
          const vertexAttributes = sanitizeBufferInputs(meta, lineProps.vertexAttributes, false);
          const endpointAttributes = sanitizeBufferInputs(meta, lineProps.endpointAttributes, true);
          const joinType = sanitizeInclusionInList(lineProps.join, 'miter', VALID_JOIN_TYPES, 'join');
          const capType = sanitizeInclusionInList(lineProps.cap, 'square', VALID_CAP_TYPES, 'cap');
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
          let endpointProps, segmentProps;

          if (lineProps.endpointAttributes && lineProps.endpointCount) {
            endpointProps = {
              buffers: endpointAttributes,
              count: lineProps.endpointCount,
              joinResolution,
              capResolution,
              capScale,
              miterLimit
            };
          }

          if (lineProps.vertexAttributes && lineProps.vertexCount) {
            segmentProps = {
              buffers: vertexAttributes,
              count: lineProps.vertexCount,
              joinResolution,
              capResolution,
              miterLimit
            };
          }

          if (segmentProps) {
            const segmentDst = joinType === 'round' ? allRoundedSegments : allMiterSegments;
            segmentDst.push(segmentProps);
          }

          if (endpointProps) {
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

          if (!reorder) flush(lineProps);
        }

        if (reorder) flush(props);
      });
    };
  }

  return src;

}));
