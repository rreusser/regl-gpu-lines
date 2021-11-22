'use strict';

const ATTR_USAGE = require('./constants/attr-usage.js');

module.exports = parseShaderPragmas;

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

function parseShaderPragmas (glsl) {
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

function parsePragma (pragma) {
  pragma = pragma.trim();
  let match;
  if ((match = pragma.match(ATTRIBUTE_REGEX))) {
    const dimension = DIMENSION_GLSL_TYPES[match[1]];
    const name = match[2];
    return {type: 'attribute', dimension, name};
  } else if ((match = pragma.match(PROPERTY_REGEX))) {
    const property = match[1];
    const returnType = {width: 'float', position: 'vec4', orientation: 'bool'}[property];
    const name = match[2];
    const inputs = match[3].split(',').map(str => str.trim()).filter(x => !!x);
    const generate = (label, prefix) => `${name}(${inputs.map(input => (prefix || '') + input + label).join(', ')})`;
    return {type: 'property', property, returnType, name, inputs, generate};
  } else if ((match = pragma.match(VARYING_REGEX))) {
    const extrapolate = match[1] === 'extrapolate';
    const returnType = match[2];
    const name = match[3];
    const getter = match[4];
    const inputs = match[5].split(',').map(str => str.trim()).filter(x => !!x);
    const generate = (interp, a, b) => {
      const clamped = extrapolate ? interp : `clamp(${interp},0.0,1.0)`;
      return `${name} = ${getter}(${inputs.map(input => `mix(${input + a}, ${input + b}, ${clamped})`).join(', ')});`;
    };
    return {type: 'varying', returnType, name, getter, inputs, generate};
  } else if ((match = pragma.match(POSTPROJECT_REGEX))) {
    const name = match[1];
    return {type: 'postproject', name};
  } else {
    throw new Error(`Unrecognized lines pragma: "${pragma}"`);
  }
}

function analyzePragmas (pragmas) {
  let postproject;
  const attrs = new Map();
  const varyings = new Map();
  for (const pragma of pragmas) {
    if (pragma.type === 'attribute') {
      attrs.set(pragma.name,  pragma);
      pragma.vertexUsage = ATTR_USAGE.NONE;
      pragma.endpointUsage = ATTR_USAGE.NONE;
    } else if (pragma.type === 'varying') {
      varyings.set(pragma.name, pragma);
    } else if (pragma.type === 'postproject') {
      postproject = pragma.name;

    }
  }

  let width, position, orientation;
  for (const pragma of pragmas) {
    if (pragma.type !== 'property') continue;

    switch(pragma.property) {
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
          inputAttr.vertexUsage |= ATTR_USAGE.EXTENDED;
          inputAttr.endpointUsage |= ATTR_USAGE.EXTENDED;
        } else if (pragma.property === 'orientation') {
          inputAttr.endpointUsage |= ATTR_USAGE.PER_INSTANCE;
        } else {
          inputAttr.endpointUsage|= ATTR_USAGE.REGULAR;
          inputAttr.vertexUsage|= ATTR_USAGE.REGULAR;
        }
      }
    }
  }
  return {varyings, attrs, width, position, orientation, postproject};
}

