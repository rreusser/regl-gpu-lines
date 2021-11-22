module.exports = createAttrSpecs;

const ATTR_USAGE = require('./constants/attr-usage.js');
const GLSL_TYPES = require('./constants/glsltypes.js');
const ORIENTATION = require('./constants/orientation.json');

// This function returns regl props, used for constructing the attribute layout regl accessors
// and corresponding GLSL up front.
function createAttrSpecs (meta, regl, isEndpoints) {
  const suffixes = isEndpoints ? ['B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
  const attrLines = [];
  const attrSpecList = [];

  meta.attrs.forEach((attr, attrName) => {
    const usage = isEndpoints ? attr.endpointUsage : attr.vertexUsage;
    if (!usage) return;

    const attrList = [];
    function emitAttr (index, suffix) {
      const attrOutName = attrName + suffix;
      attrList.push(attrOutName);

      if (isEndpoints) {
        const instanceStride = usage & ATTR_USAGE.PER_INSTANCE ? 1 : 3;
        attrSpecList.push({
          name: attrOutName,
          spec: {
            buffer: (ctx, props) => props.buffers[attrName].buffer,
            offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * (((props.orientation === ORIENTATION.CAP_START || !props.splitCaps)? 0 : 3) + index),
            stride: (ctx, props) => props.buffers[attrName].stride * instanceStride * (props.splitCaps ? 2 : 1),
            divisor: (ctx, props) => props.buffers[attrName].divisor,
          }
        });
      } else {
        attrSpecList.push({
          name: attrOutName,
          spec: {
            buffer: (ctx, props) => props.buffers[attrName].buffer,
            offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * index,
            stride: (ctx, props) => props.buffers[attrName].stride,
            divisor: (ctx, props) => props.buffers[attrName].divisor,
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
