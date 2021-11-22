(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.reglLines = factory());
})(this, (function () { 'use strict';

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);

      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
  }

  function _iterableToArrayLimit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;

    var _s, _e;

    try {
      for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _createForOfIteratorHelper(o, allowArrayLike) {
    var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];

    if (!it) {
      if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
        if (it) o = it;
        var i = 0;

        var F = function () {};

        return {
          s: F,
          n: function () {
            if (i >= o.length) return {
              done: true
            };
            return {
              done: false,
              value: o[i++]
            };
          },
          e: function (e) {
            throw e;
          },
          f: F
        };
      }

      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }

    var normalCompletion = true,
        didErr = false,
        err;
    return {
      s: function () {
        it = it.call(o);
      },
      n: function () {
        var step = it.next();
        normalCompletion = step.done;
        return step;
      },
      e: function (e) {
        didErr = true;
        err = e;
      },
      f: function () {
        try {
          if (!normalCompletion && it.return != null) it.return();
        } finally {
          if (didErr) throw err;
        }
      }
    };
  }

  var CAP_START = 0;
  var CAP_END = 1;
  var CAP_SHORT = 2;
  var require$$5 = {
  	CAP_START: CAP_START,
  	CAP_END: CAP_END,
  	CAP_SHORT: CAP_SHORT
  };

  var ORIENTATION$2 = require$$5;
  var drawSegment = createDrawSegmentCommand;

  function createDrawSegmentCommand(regl, isEndpoints, insertCaps, isVAO, meta, frag, segmentSpec, endpointSpec, indexAttributes, forwardedCmdConfig, forwardedUniforms, debug) {
    var spec = isEndpoints ? endpointSpec : segmentSpec;
    var verts = ['B', 'C', 'D'];
    if (!isEndpoints) verts.unshift('A');
    var attributes = {};
    var vaoProps = {};
    var attrList = indexAttributes.concat(spec.attrs);

    if (isVAO) {
      vaoProps.vao = regl.prop('vao');

      for (var i = 0; i < attrList.length; i++) {
        attributes[attrList[i].name] = i;
      }
    } else {
      var _iterator = _createForOfIteratorHelper(attrList),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var attr = _step.value;
          attributes[attr.name] = attr.spec;
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    var computeCount = insertCaps ? isEndpoints // Cap has fixed number, join could either be a cap or a join
    ? function (props) {
      return [props.capRes2, Math.max(props.capRes2, props.joinRes2)];
    } // Both could be either a cap or a join
    : function (props) {
      return [Math.max(props.capRes2, props.joinRes2), Math.max(props.capRes2, props.joinRes2)];
    } : isEndpoints // Draw a cap
    ? function (props) {
      return [props.capRes2, props.joinRes2];
    } // Draw two joins
    : function (props) {
      return [props.joinRes2, props.joinRes2];
    };
    return regl(_objectSpread2(_objectSpread2({
      // Insert user GLSL at the top
      vert: "".concat(meta.glsl, "\nconst float CAP_START = ").concat(ORIENTATION$2.CAP_START, ".0;\nconst float CAP_END = ").concat(ORIENTATION$2.CAP_END, ".0;\n\n// Attribute specification\n").concat(spec.glsl, "\n\nattribute float index;\n").concat(debug ? 'attribute float debugInstanceID;' : '', "\n\nuniform bool _isRound;\nuniform vec2 _vertCnt2, _capJoinRes2;\nuniform vec2 _resolution, _capScale;\nuniform float _miterLimit;\n").concat(meta.orientation || !isEndpoints ? '' : 'uniform float _orientation;', "\n\nvarying vec3 lineCoord;\n").concat(debug ? 'varying vec2 triStripCoord;' : '', "\n").concat(debug ? 'varying float instanceID;' : '', "\n").concat(debug ? 'varying float vertexIndex;' : '', "\n\n// This turns out not to work very well\nbool isnan(float val) {\n  return (val < 0.0 || 0.0 < val || val == 0.0) ? false : true;\n}\n\nbool invalid(vec4 p) {\n  return p.w == 0.0 || isnan(p.x);\n}\n\nvoid main() {\n  const float pi = 3.141592653589793;\n\n  ").concat(debug ? 'vertexIndex = index;' : '', "\n  lineCoord = vec3(0);\n\n  ").concat(debug ? "instanceID = ".concat(isEndpoints ? '-1.0' : 'debugInstanceID', ";") : '', "\n  ").concat(debug ? 'triStripCoord = vec2(floor(index / 2.0), mod(index, 2.0));' : '', "\n\n  ").concat(verts.map(function (vert) {
        return "vec4 p".concat(vert, " = ").concat(meta.position.generate(vert), ";");
      }).join('\n'), "\n\n  // A sensible default for early returns\n  gl_Position = pB;\n\n  bool aInvalid = ").concat(isEndpoints ? 'false' : 'invalid(pA)', ";\n  bool bInvalid = invalid(pB);\n  bool cInvalid = invalid(pC);\n  bool dInvalid = invalid(pD);\n\n  // Vertex count for each part (first half of join, second (mirrored) half). Note that not all of\n  // these vertices may be used, for example if we have enough for a round cap but only draw a miter\n  // join.\n  vec2 v = _vertCnt2 + 3.0;\n\n  // Total vertex count\n  float N = dot(v, vec2(1));\n\n  // If we're past the first half-join and half of the segment, then we swap all vertices and start\n  // over from the opposite end.\n  bool mirror = index >= v.x;\n\n  // When rendering dedicated endoints, this allows us to insert an end cap *alone* (without the attached\n  // segment and join)\n  ").concat(isEndpoints ? "if (dInvalid && mirror) return;" : '', "\n\n  // Convert to screen-pixel coordinates\n  // Save w so we can perspective re-multiply at the end to get varyings depth-correct\n  float pw = mirror ? pC.w : pB.w;\n  ").concat(verts.map(function (v) {
        return "p".concat(v, " = vec4(vec3(p").concat(v, ".xy * _resolution, p").concat(v, ".z) / p").concat(v, ".w, 1);");
      }).join('\n'), "\n\n  // If it's a cap, mirror A back onto C to accomplish a round\n  ").concat(isEndpoints ? "vec4 pA = pC;" : '', "\n\n  // Reject if invalid or if outside viewing planes\n  if (bInvalid || cInvalid || max(abs(pB.z), abs(pC.z)) > 1.0) return;\n\n  // Swap everything computed so far if computing mirrored half\n  if (mirror) {\n    vec4 vTmp = pC; pC = pB; pB = vTmp;\n    vTmp = pD; pD = pA; pA = vTmp;\n    bool bTmp = dInvalid; dInvalid = aInvalid; aInvalid = bTmp;\n  }\n\n  ").concat(isEndpoints ? "bool isCap = !mirror;" : "".concat(insertCaps ? '' : 'const ', "bool isCap = false"), ";\n\n  // Either flip A onto C (and D onto B) to produce a 180 degree-turn cap, or extrapolate to produce a\n  // degenerate (no turn) join, depending on whether we're inserting caps or just leaving ends hanging.\n  if (aInvalid) { ").concat(insertCaps ? 'pA = pC; isCap = true;' : 'pA = 2.0 * pB - pC;', " }\n  if (dInvalid) { ").concat(insertCaps ? 'pD = pB;' : 'pD = 2.0 * pC - pB;', " }\n  bool roundOrCap = _isRound || isCap;\n\n  // TODO: swap inputs rather than computing both and discarding one\n  float width = mirror ? ").concat(meta.width.generate('C'), " : ").concat(meta.width.generate('B'), ";\n\n  // Tangent and normal vectors\n  vec2 tBC = pC.xy - pB.xy;\n  float lBC = length(tBC);\n  tBC /= lBC;\n  vec2 nBC = vec2(-tBC.y, tBC.x);\n\n  vec2 tAB = pB.xy - pA.xy;\n  float lAB = length(tAB);\n  if (lAB > 0.0) tAB /= lAB;\n  vec2 nAB = vec2(-tAB.y, tAB.x);\n\n  vec2 tCD = pD.xy - pC.xy;\n  float lCD = length(tCD);\n  if (lCD > 0.0) tCD /= lCD;\n  vec2 nCD = vec2(-tCD.y, tCD.x);\n\n  // Clamp for safety, since we take the arccos\n  float cosB = clamp(dot(tAB, tBC), -1.0, 1.0);\n\n  // This section is somewhat fragile. When lines are collinear, signs flip randomly and break orientation\n  // of the middle segment. The fix appears straightforward, but this took a few hours to get right.\n  const float tol = 1e-4;\n  float mirrorSign = mirror ? -1.0 : 1.0;\n  float dirB = -dot(tBC, nAB);\n  float dirC = dot(tBC, nCD);\n  bool bCollinear = abs(dirB) < tol;\n  bool cCollinear = abs(dirC) < tol;\n  bool bIsHairpin = bCollinear && cosB < 0.0;\n  // bool cIsHairpin = cCollinear && dot(tBC, tCD) < 0.0;\n  dirB = bCollinear ? -mirrorSign : sign(dirB);\n  dirC = cCollinear ? -mirrorSign : sign(dirC);\n\n  vec2 miter = bIsHairpin ? -tBC : 0.5 * (nAB + nBC) * dirB;\n\n  // Compute our primary \"join index\", that is, the index starting at the very first point of the join.\n  // The second half of the triangle strip instance is just the first, reversed, and with vertices swapped!\n  float i = mirror ? N - index : index;\n\n  // Decide the resolution of whichever feature we're drawing. n is twice the number of points used since\n  // that's the only form in which we use this number.\n  float res = (isCap ? _capJoinRes2.x : _capJoinRes2.y);\n\n  // Shift the index to send unused vertices to an index below zero, which will then just get clamped to\n  // zero and result in repeated points, i.e. degenerate triangles.\n  i -= max(0.0, (mirror ? _vertCnt2.y : _vertCnt2.x) - res);\n\n  // Use the direction to offset the index by one. This has the effect of flipping the winding number so\n  // that it's always consistent no matter which direction the join turns.\n  i += (dirB < 0.0 ? -1.0 : 0.0);\n\n  // Vertices of the second (mirrored) half of the join are offset by one to get it to connect correctly\n  // in the middle, where the mirrored and unmirrored halves meet.\n  i -= mirror ? 1.0 : 0.0;\n\n  // Clamp to zero and repeat unused excess vertices.\n  i = max(0.0, i);\n\n  // Start with a default basis pointing along the segment with normal vector outward\n  vec2 xBasis = tBC;\n  vec2 yBasis = nBC * dirB;\n\n  // Default point is 0 along the segment, 1 (width unit) normal to it\n  vec2 xy = vec2(0);\n\n  lineCoord.y = dirB * mirrorSign;\n\n  if (i == res + 1.0) {\n    // pick off this one specific index to be the interior miter point\n    // If not div-by-zero, then sinB / (1 + cosB)\n    float m = cosB > -0.9999 ? (tAB.x * tBC.y - tAB.y * tBC.x) / (1.0 + cosB) : 0.0;\n    xy = vec2(min(abs(m), min(lBC, lAB) / width), -1);\n    lineCoord.y = -lineCoord.y;\n  } else {\n    // Draw half of a join\n    float m2 = dot(miter, miter);\n    float lm = sqrt(m2);\n    yBasis = miter / lm;\n    xBasis = dirB * vec2(yBasis.y, -yBasis.x);\n    bool isBevel = 1.0 > _miterLimit * m2;\n\n    if (mod(i, 2.0) == 0.0) {\n      // Outer joint points\n      if (roundOrCap || i != 0.0) {\n        // Round joins\n        float theta = -0.5 * (acos(cosB) * (clamp(i, 0.0, res) / res) - pi) * (isCap ? 2.0 : 1.0);\n        xy = vec2(cos(theta), sin(theta));\n\n        if (isCap) {\n          // A special multiplier factor for turning 3-point rounds into square caps (but leave the\n          // y == 0.0 point unaffected)\n          if (xy.y > 0.001) xy *= _capScale;\n          lineCoord.xy = xy.yx * lineCoord.y;\n        }\n      } else {\n        // Miter joins\n        yBasis = bIsHairpin ? vec2(0) : miter;\n        xy.y = isBevel ? 1.0 : 1.0 / m2;\n      }\n    } else {\n      // Center of the fan\n      lineCoord.y = 0.0;\n\n      // Offset the center vertex position to get bevel SDF correct\n      if (isBevel && !roundOrCap) {\n        xy.y = -1.0 + sqrt((1.0 + cosB) * 0.5);\n      }\n    }\n  }\n\n  ").concat(isEndpoints ? "float _orientation = ".concat(meta.orientation ? meta.orientation.generate('') : 'mod(_orientation,2.0)', ";") : '', ";\n\n  // Since we can't know the orientation of end caps without being told. This comes either from\n  // input via the orientation property or from a uniform, assuming caps are interleaved (start,\n  // end, start, end, etc.) and rendered in two passes: first starts, then ends.\n  ").concat(isEndpoints ? "if (_orientation == CAP_END) lineCoord.xy = -lineCoord.xy;" : '', "\n\n  // Point offset from main vertex position\n  vec2 dP = mat2(xBasis, yBasis) * xy;\n\n  // Dot with the tangent to account for dashes. Note that by putting this in *one place*, dashes\n  // should always be correct without having to compute a unique correction for every point.\n  float dx = dot(dP, tBC) * mirrorSign;\n\n  // Interpolant: zero for using B, 1 for using C\n  float useC = (mirror ? 1.0 : 0.0) + dx * (width / lBC);\n\n  lineCoord.z = useC < 0.0 || useC > 1.0 ? 1.0 : 0.0;\n\n  // The varying generation code handles clamping, if needed\n  ").concat(_toConsumableArray(meta.varyings.values()).map(function (varying) {
        return varying.generate('useC', 'B', 'C');
      }).join('\n'), "\n\n  gl_Position = pB;\n  gl_Position.xy += width * dP;\n  gl_Position.xy /= _resolution;\n  gl_Position *= pw;\n  ").concat(meta.postproject ? "gl_Position = ".concat(meta.postproject, "(gl_Position);") : '', "\n}"),
      frag: frag,
      attributes: attributes,
      uniforms: _objectSpread2(_objectSpread2({}, forwardedUniforms), {}, {
        _vertCnt2: function _vertCnt2(ctx, props) {
          return computeCount(props);
        },
        _capJoinRes2: function _capJoinRes2(ctx, props) {
          return [props.capRes2, props.joinRes2];
        },
        _miterLimit: function _miterLimit(ctx, props) {
          return props.miterLimit * props.miterLimit;
        },
        _orientation: regl.prop('orientation'),
        _capScale: regl.prop('capScale'),
        _isRound: function _isRound(ctx, props) {
          return props.join === 'round';
        },
        _resolution: function _resolution(ctx, props) {
          return props.viewportSize || [ctx.viewportWidth, ctx.viewportHeight];
        }
      }),
      primitive: 'triangle strip',
      instances: isEndpoints ? function (ctx, props) {
        return props.splitCaps ? props.orientation === ORIENTATION$2.CAP_START ? Math.ceil(props.count / 2) : Math.floor(props.count / 2) : props.count;
      } : function (ctx, props) {
        return props.count - 3;
      },
      count: function count(ctx, props) {
        var count = computeCount(props);
        return 6 + (count[0] + count[1]);
      }
    }, forwardedCmdConfig), vaoProps));
  }

  var attrUsage = {
    NONE: 0,
    REGULAR: 1,
    EXTENDED: 2,
    PER_INSTANCE: 4
  };

  var ATTR_USAGE$1 = attrUsage;
  var parsePragmas = parseShaderPragmas$1;
  var PRAGMA_REGEX = /^\s*#pragma\s+lines\s*:\s*([^;]*);?$/i;
  var ATTRIBUTE_REGEX = /^\s*attribute\s+(float|vec2|vec3|vec4)\s+([\w\d_]+)\s*$/i;
  var PROPERTY_REGEX = /^\s*(position|width|orientation)\s+=\s+([\w\d_]+)\s*\(([^)]*)\)\s*$/i;
  var VARYING_REGEX = /^\s*(?:(extrapolate)?)\s*varying\s+(float|vec2|vec3|vec4)\s+([\w\d_]+)\s*=\s*([\w\d_]+)\(([^)]*)\)\s*$/;
  var POSTPROJECT_REGEX = /^\s*postproject\s+=\s+([\w\d_]+)\s*$/i;
  var DIMENSION_GLSL_TYPES = {
    "float": 1,
    "vec2": 2,
    "vec3": 3,
    "vec4": 4
  };

  function parseShaderPragmas$1(glsl) {
    var pragmas = [];
    var lines = glsl.split('\n');

    for (var i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(PRAGMA_REGEX, function (match, pragma) {
        pragmas.push(parsePragma(pragma));
        return '';
      });
    }

    return _objectSpread2({
      glsl: lines.join('\n').trim()
    }, analyzePragmas(pragmas));
  }

  function parsePragma(pragma) {
    pragma = pragma.trim();
    var match;

    if (match = pragma.match(ATTRIBUTE_REGEX)) {
      var dimension = DIMENSION_GLSL_TYPES[match[1]];
      var name = match[2];
      return {
        type: 'attribute',
        dimension: dimension,
        name: name
      };
    } else if (match = pragma.match(PROPERTY_REGEX)) {
      var property = match[1];
      var returnType = {
        width: 'float',
        position: 'vec4',
        orientation: 'bool'
      }[property];
      var _name = match[2];
      var inputs = match[3].split(',').map(function (str) {
        return str.trim();
      }).filter(function (x) {
        return !!x;
      });

      var generate = function generate(label, prefix) {
        return "".concat(_name, "(").concat(inputs.map(function (input) {
          return (prefix || '') + input + label;
        }).join(', '), ")");
      };

      return {
        type: 'property',
        property: property,
        returnType: returnType,
        name: _name,
        inputs: inputs,
        generate: generate
      };
    } else if (match = pragma.match(VARYING_REGEX)) {
      var extrapolate = match[1] === 'extrapolate';
      var _returnType = match[2];
      var _name2 = match[3];
      var getter = match[4];

      var _inputs = match[5].split(',').map(function (str) {
        return str.trim();
      }).filter(function (x) {
        return !!x;
      });

      var _generate = function _generate(interp, a, b) {
        var clamped = extrapolate ? interp : "clamp(".concat(interp, ",0.0,1.0)");
        return "".concat(_name2, " = ").concat(getter, "(").concat(_inputs.map(function (input) {
          return "mix(".concat(input + a, ", ").concat(input + b, ", ").concat(clamped, ")");
        }).join(', '), ");");
      };

      return {
        type: 'varying',
        returnType: _returnType,
        name: _name2,
        getter: getter,
        inputs: _inputs,
        generate: _generate
      };
    } else if (match = pragma.match(POSTPROJECT_REGEX)) {
      var _name3 = match[1];
      return {
        type: 'postproject',
        name: _name3
      };
    } else {
      throw new Error("Unrecognized lines pragma: \"".concat(pragma, "\""));
    }
  }

  function analyzePragmas(pragmas) {
    var postproject;
    var attrs = new Map();
    var varyings = new Map();

    var _iterator = _createForOfIteratorHelper(pragmas),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var pragma = _step.value;

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
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    var width, position, orientation;

    var _iterator2 = _createForOfIteratorHelper(pragmas),
        _step2;

    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var _pragma = _step2.value;
        if (_pragma.type !== 'property') continue;

        switch (_pragma.property) {
          case 'width':
            if (width) throw new Error("Unexpected duplicate pragma for property \"".concat(_pragma.property, "\""));
            width = _pragma;
            break;

          case 'position':
            if (position) throw new Error("Unexpected duplicate pragma for property \"".concat(_pragma.property, "\""));
            position = _pragma;
            break;

          case 'orientation':
            if (orientation) throw new Error("Unexpected duplicate pragma for property \"".concat(_pragma.property, "\""));
            orientation = _pragma;
            break;

          default:
            throw new Error("Invalid pragma property \"".concat(_pragma.property, "\""));
        }

        var _iterator4 = _createForOfIteratorHelper(_pragma.inputs),
            _step4;

        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var input = _step4.value;
            if (!attrs.has(input)) throw new Error("Missing attribute ".concat(input, " of property ").concat(_pragma.property));
          }
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }

    var _iterator3 = _createForOfIteratorHelper(pragmas),
        _step3;

    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        var _pragma2 = _step3.value;
        if (!_pragma2.inputs) continue;

        var _iterator5 = _createForOfIteratorHelper(_pragma2.inputs),
            _step5;

        try {
          for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
            var _input = _step5.value;
            var inputAttr = attrs.get(_input);

            if (_pragma2.type === 'property' || _pragma2.type === 'varying') {
              if (_pragma2.property === 'position') {
                inputAttr.vertexUsage |= ATTR_USAGE$1.EXTENDED;
                inputAttr.endpointUsage |= ATTR_USAGE$1.EXTENDED;
              } else if (_pragma2.property === 'orientation') {
                inputAttr.endpointUsage |= ATTR_USAGE$1.PER_INSTANCE;
              } else {
                inputAttr.endpointUsage |= ATTR_USAGE$1.REGULAR;
                inputAttr.vertexUsage |= ATTR_USAGE$1.REGULAR;
              }
            }
          }
        } catch (err) {
          _iterator5.e(err);
        } finally {
          _iterator5.f();
        }
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }

    return {
      varyings: varyings,
      attrs: attrs,
      width: width,
      position: position,
      orientation: orientation,
      postproject: postproject
    };
  }

  var DTYPES_SIZES = [];
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
  var DTYPE_SIZES = dtypesizes;
  var DTYPES = require$$1;

  function has(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  } // This function is run on every draw call in order to sanitize and configure the data layout


  function sanitizeBufferInput(metadata, buffersObj, isEndpoints) {
    //console.log('metadata:', metadata);
    //console.log('buffersObj:', buffersObj);
    //console.log('isEndpoints:', isEndpoints);
    var outputs = {};
    if (!buffersObj) return outputs;

    var _iterator = _createForOfIteratorHelper(metadata.attrs),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var _step$value = _slicedToArray(_step.value, 2),
            attrName = _step$value[0],
            attrMeta = _step$value[1];

        var input = buffersObj[attrName];
        var usage = isEndpoints ? attrMeta.endpointUsage : attrMeta.vertexUsage;
        if (!usage) continue;
        var output = {
          buffer: null,
          dimension: attrMeta.dimension,
          offset: 0,
          type: NaN,
          stride: NaN,
          divisor: 1,
          bytesPerElement: NaN
        };

        if (!input) {
          throw new Error("Missing buffer for ".concat(isEndpoints ? 'endpoint' : 'vertex', " attribute '").concat(attrName, "'"));
        } else if (input._reglType === 'buffer') {
          output.buffer = input;
          output.type = output.buffer._buffer.dtype;
        } else if (input.buffer._reglType === 'buffer') {
          output.buffer = input.buffer;

          if (has(input, 'dimension') && input.dimension !== output.dimension) {
            throw new Error("Size of attribute (".concat(input.dimension, ") does not match dimension specified in shader pragma (").concat(attrMeta.dimension, ")"));
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
          throw new Error("Invalid buffer for attribute '".concat(attrName, "'"));
        }

        output.bytesPerElement = DTYPE_SIZES[output.type];

        if (Number.isNaN(output.stride)) {
          output.stride = output.bytesPerElement * attrMeta.dimension;
        }

        outputs[attrName] = output;
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return outputs;
  }

  var GLSL_TYPES$1 = [];
  GLSL_TYPES$1[1] = 'float';
  GLSL_TYPES$1[2] = 'vec2';
  GLSL_TYPES$1[3] = 'vec3';
  GLSL_TYPES$1[4] = 'vec4';
  var glsltypes = GLSL_TYPES$1;

  var createAttrSpec$1 = createAttrSpecs;
  var ATTR_USAGE = attrUsage;
  var GLSL_TYPES = glsltypes;
  var ORIENTATION$1 = require$$5; // This function returns regl props, used for constructing the attribute layout regl accessors
  // and corresponding GLSL up front.

  function createAttrSpecs(meta, regl, isEndpoints) {
    var suffixes = isEndpoints ? ['B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
    var attrLines = [];
    var attrSpecList = [];
    meta.attrs.forEach(function (attr, attrName) {
      var usage = isEndpoints ? attr.endpointUsage : attr.vertexUsage;
      if (!usage) return;
      var attrList = [];

      function emitAttr(index, suffix) {
        var attrOutName = attrName + suffix;
        attrList.push(attrOutName);

        if (isEndpoints) {
          var instanceStride = usage & ATTR_USAGE.PER_INSTANCE ? 1 : 3;
          attrSpecList.push({
            name: attrOutName,
            spec: {
              buffer: function buffer(ctx, props) {
                return props.buffers[attrName].buffer;
              },
              offset: function offset(ctx, props) {
                return props.buffers[attrName].offset + props.buffers[attrName].stride * ((props.orientation === ORIENTATION$1.CAP_START || !props.splitCaps ? 0 : 3) + index);
              },
              stride: function stride(ctx, props) {
                return props.buffers[attrName].stride * instanceStride * (props.splitCaps ? 2 : 1);
              },
              divisor: function divisor(ctx, props) {
                return props.buffers[attrName].divisor;
              }
            }
          });
        } else {
          attrSpecList.push({
            name: attrOutName,
            spec: {
              buffer: function buffer(ctx, props) {
                return props.buffers[attrName].buffer;
              },
              offset: function offset(ctx, props) {
                return props.buffers[attrName].offset + props.buffers[attrName].stride * index;
              },
              stride: function stride(ctx, props) {
                return props.buffers[attrName].stride;
              },
              divisor: function divisor(ctx, props) {
                return props.buffers[attrName].divisor;
              }
            }
          });
        }
      }

      if (usage & ATTR_USAGE.PER_INSTANCE) {
        emitAttr(0, '');
      }

      if (usage & ATTR_USAGE.REGULAR || usage & ATTR_USAGE.EXTENDED) {
        for (var i = 0; i < suffixes.length; i++) {
          var suffix = suffixes[i];
          if (!(usage & ATTR_USAGE.EXTENDED) && (suffix === 'D' || suffix === 'A')) continue;
          emitAttr(i, suffix);
        }
      }

      attrLines.push("attribute ".concat(GLSL_TYPES[attr.dimension], " ").concat(attrList.join(', '), ";"));
    });
    meta.varyings.forEach(function (varying, varyingName) {
      attrLines.push("varying ".concat(varying.returnType, " ").concat(varyingName, ";"));
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
        throw new Error("Invalid ".concat(label, " type. Valid options are: ").concat(list.join(', '), "."));
      }

      return value;
    };
  };

  var createDrawSegment = drawSegment;
  var parseShaderPragmas = parsePragmas;
  var sanitizeBufferInputs = sanitizeBuffer;
  var createAttrSpec = createAttrSpec$1;
  var sanitizeInclusionInList = sanitizeInList;
  var ORIENTATION = require$$5;
  var src = reglLines;
  reglLines.CAP_START = ORIENTATION.CAP_START;
  reglLines.CAP_END = ORIENTATION.CAP_END;
  var FORBIDDEN_REGL_PROPS = new Set(['attributes', 'elements']);
  var VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
  var VALID_CAP_TYPES = ['round', 'square', 'none'];
  var ROUND_CAP_SCALE = [1, 1];
  var SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)]; // Max possible is 62, but we probably don't need that many

  var MAX_ROUND_JOIN_RESOLUTION = 32;
  var MAX_DEBUG_VERTICES = 16384;
  var FEATUREMASK_IS_ENDPOINTS = 1 << 0;
  var FEATUREMASK_INSERT_CAPS = 1 << 1;
  var FEATUREMASK_VAO = 1 << 2;

  function getCacheKey(isEndpoints, insertCaps, isVAO) {
    return (isEndpoints ? FEATUREMASK_IS_ENDPOINTS : 0) + (insertCaps ? FEATUREMASK_INSERT_CAPS : 0) + (isVAO ? FEATUREMASK_VAO : 0);
  }

  function reglLines(regl) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var _opts$vert = opts.vert,
        vert = _opts$vert === void 0 ? null : _opts$vert,
        _opts$frag = opts.frag,
        frag = _opts$frag === void 0 ? null : _opts$frag,
        _opts$debug = opts.debug,
        debug = _opts$debug === void 0 ? false : _opts$debug,
        _opts$reorder = opts.reorder,
        reorder = _opts$reorder === void 0 ? false : _opts$reorder;
    if (!regl._gpuLinesCache) regl._gpuLinesCache = {};
    var cache = regl._gpuLinesCache; // Forward all regl parameters except for vert and frag and a couple forbidden parameters along to regl.

    var forwardedCmdConfig = _objectSpread2({}, opts);

    var forwardedUniforms = opts.uniforms || {};

    for (var _i = 0, _arr = ['vert', 'frag', 'debug', 'reorder', 'uniforms']; _i < _arr.length; _i++) {
      var prop = _arr[_i];
      delete forwardedCmdConfig[prop];
    }

    var forwarded = Object.keys(forwardedCmdConfig);
    forwarded.forEach(function (fwd) {
      if (FORBIDDEN_REGL_PROPS.has(fwd)) {
        throw new Error("Invalid parameter '".concat(fwd, "'. Parameters ").concat(_toConsumableArray(FORBIDDEN_REGL_PROPS).map(function (p) {
          return "'".concat(p, "'");
        }).join(', '), " may not be forwarded to regl."));
      }
    });
    if (!vert) throw new Error('Missing vertex shader, `vert`');
    if (!frag) throw new Error('Missing fragment shader, `frag`');
    var meta = parseShaderPragmas(vert);
    var segmentSpec = createAttrSpec(meta, regl, false);
    var endpointSpec = createAttrSpec(meta, regl, true);
    var indexAttributes = [];

    if (debug) {
      // TODO: Allocate/grow lazily to avoid an arbitrary limit
      if (!cache.debugInstanceIDBuffer) {
        cache.debugInstanceIDBuffer = regl.buffer(new Uint16Array(_toConsumableArray(Array(MAX_DEBUG_VERTICES).keys())));
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
      cache.indexBuffer = regl.buffer(new Uint8Array(_toConsumableArray(Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys())));
    }

    indexAttributes.push({
      name: 'index',
      spec: {
        buffer: cache.indexBuffer,
        divisor: 0
      }
    });
    var sanitizeJoinType = sanitizeInclusionInList('join', VALID_JOIN_TYPES, 'miter');
    var sanitizeCapType = sanitizeInclusionInList('cap', VALID_CAP_TYPES, 'square');
    var drawCommands = new Map();

    function getDrawCommand(featureMask) {
      if (!drawCommands.has(featureMask)) {
        drawCommands.set(featureMask, createDrawSegment(regl, featureMask & FEATUREMASK_IS_ENDPOINTS, featureMask & FEATUREMASK_INSERT_CAPS, featureMask & FEATUREMASK_VAO, meta, frag, segmentSpec, endpointSpec, indexAttributes, forwardedCmdConfig, forwardedUniforms, debug));
      }

      return drawCommands.get(featureMask);
    }

    var drawQueue = [];

    function queue() {
      for (var _len = arguments.length, propsList = new Array(_len), _key = 0; _key < _len; _key++) {
        propsList[_key] = arguments[_key];
      }

      drawQueue.push.apply(drawQueue, propsList);
    }

    function flushDrawQueue() {
      // Sort by the identifier of the draw command so group together commands using the same shader
      if (reorder) drawQueue.sort(function (a, b) {
        return a.featureMask - b.featureMask;
      });
      var pos = 0;
      var groupedProps = []; // Iterate through the queue. Group props until the command changes, then draw and continue

      while (pos < drawQueue.length) {
        var _drawQueue$pos = drawQueue[pos],
            featureMask = _drawQueue$pos.featureMask,
            props = _drawQueue$pos.props;
        groupedProps.push(props);

        while (++pos < drawQueue.length && drawQueue[pos].featureMask === featureMask) {
          groupedProps.push(drawQueue[pos].props);
        } // console.log('isEndpoints:', !!(FEATUREMASK_IS_ENDPOINTS & featureMask), 'insertCaps:', !!(FEATUREMASK_INSERT_CAPS & featureMask), 'batching:', groupedProps.length);


        getDrawCommand(featureMask)(groupedProps);
        groupedProps.length = 0;
      }

      drawQueue.length = 0;
    }

    var returnValue = function drawLines(props) {
      if (!props) return;
      if (!Array.isArray(props)) props = [props];

      var _iterator = _createForOfIteratorHelper(props),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var userProps = _step.value;
          var join = sanitizeJoinType(userProps.join);
          var cap = sanitizeCapType(userProps.cap);
          var isVAO = !!userProps.vao;
          var capRes2 = userProps.capResolution === undefined ? 12 : userProps.capResolution;

          if (cap === 'square') {
            capRes2 = 3;
          } else if (cap === 'none') {
            capRes2 = 1;
          }

          var joinRes2 = 1;

          if (join === 'round') {
            joinRes2 = userProps.joinResolution === undefined ? 8 : userProps.joinResolution;
          } // We only ever use these in doubled-up form


          capRes2 *= 2;
          joinRes2 *= 2;
          var miterLimit = join === 'bevel' ? 1 : userProps.miterLimit === undefined ? 4 : userProps.miterLimit;
          var capScale = cap === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;
          var insertCaps = !!userProps.insertCaps;
          var sharedProps = {
            joinRes2: joinRes2,
            capRes2: capRes2,
            capScale: capScale,
            join: join,
            miterLimit: miterLimit,
            insertCaps: insertCaps
          };

          if (userProps.endpointCount) {
            var endpointProps = _objectSpread2(_objectSpread2({
              count: userProps.endpointCount
            }, userProps), sharedProps);

            var featureMask = getCacheKey(true, insertCaps, isVAO);

            if (isVAO) {
              if (meta.orientation) {
                var vao = {
                  vao: endpointProps.vao.endpoints
                };
                queue({
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2({}, endpointProps), vao)
                });
              } else {
                var startVao = {
                  vao: endpointProps.vao.startCaps
                };
                var endVao = {
                  vao: endpointProps.vao.endCaps
                };
                queue({
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2(_objectSpread2({}, endpointProps), startVao), {}, {
                    orientation: ORIENTATION.CAP_START,
                    splitCaps: true
                  })
                }, {
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2(_objectSpread2({}, endpointProps), endVao), {}, {
                    orientation: ORIENTATION.CAP_END,
                    splitCaps: true
                  })
                });
              }
            } else {
              endpointProps.buffers = sanitizeBufferInputs(meta, userProps.endpointAttributes, true);

              if (meta.orientation) {
                queue({
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2({}, endpointProps), {}, {
                    splitCaps: false
                  })
                });
              } else {
                queue({
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2({}, endpointProps), {}, {
                    orientation: ORIENTATION.CAP_START,
                    splitCaps: true
                  })
                }, {
                  featureMask: featureMask,
                  props: _objectSpread2(_objectSpread2({}, endpointProps), {}, {
                    orientation: ORIENTATION.CAP_END,
                    splitCaps: true
                  })
                });
              }
            }
          }

          if (userProps.vertexCount) {
            var _featureMask = getCacheKey(false, insertCaps, isVAO);

            var _props = _objectSpread2(_objectSpread2({
              count: userProps.vertexCount
            }, userProps), sharedProps);

            if (isVAO) {
              _props.vao = userProps.vao.vertices;
            } else {
              _props.buffers = sanitizeBufferInputs(meta, userProps.vertexAttributes, false);
            }

            queue({
              featureMask: _featureMask,
              props: _props
            });
          }

          flushDrawQueue();
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    };

    returnValue.vao = function (props) {
      var outputs = {};
      var cases = [['vertices', segmentSpec.attrs, props.vertexAttributes, false]];

      if (meta.orientation) {
        cases.push(['endpoints', endpointSpec.attrs, props.endpointAttributes, true, false, null]);
      } else {
        cases.push(['startCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_START], ['endCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_END]);
      }

      for (var _i2 = 0, _cases = cases; _i2 < _cases.length; _i2++) {
        var _cases$_i = _slicedToArray(_cases[_i2], 6),
            outputName = _cases$_i[0],
            specAttrs = _cases$_i[1],
            attrs = _cases$_i[2],
            isEndpoints = _cases$_i[3],
            splitCaps = _cases$_i[4],
            orientation = _cases$_i[5];

        if (!attrs) continue;
        var fakeProps = {
          buffers: sanitizeBufferInputs(meta, attrs, isEndpoints),
          splitCaps: splitCaps,
          orientation: orientation
        };
        var vaoData = [];

        var _iterator2 = _createForOfIteratorHelper(indexAttributes.concat(specAttrs)),
            _step2;

        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var attr = _step2.value;
            var vaoEntry = {};

            for (var _i3 = 0, _arr2 = ['buffer', 'divisor', 'offset', 'stride', 'normalized', 'dimension']; _i3 < _arr2.length; _i3++) {
              var item = _arr2[_i3];
              var value = attr.spec[item];
              if (value && value.data) value = value.data;
              if (typeof value === 'function') value = value({}, fakeProps);
              if (value !== undefined) vaoEntry[item] = value;
            }

            vaoData.push(vaoEntry);
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }

        outputs[outputName] = regl.vao(vaoData);
      }

      outputs.destroy = function destroy() {
        var _iterator3 = _createForOfIteratorHelper(cases),
            _step3;

        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var _step3$value = _slicedToArray(_step3.value, 1),
                _outputName = _step3$value[0];

            if (!outputs[_outputName]) continue;

            outputs[_outputName].destroy();

            delete outputs[_outputName];
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      };

      return outputs;
    };

    return returnValue;
  }

  return src;

}));
