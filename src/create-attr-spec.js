module.exports = createAttrSpecs;

const ATTR_USAGE = require('./attr-usage.js');
const GLSL_TYPES = require('./glsltypes.js');

function createAttrSpecs (meta, regl, isEndpoints) {
  const suffixes = isEndpoints ? ['B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
  const attrLines = [];
  const attrSpecs = {};

  meta.attrs.forEach((attr, attrName) => {
    const usage = isEndpoints ? attr.endpointUsage : attr.vertexUsage;

    if (!usage) return;

    /*
    function wrap(label, cb) {
      return function (ctx, props) {
        const value = cb(ctx, props);
        console.log(label, attrName, value);
        return value;
      }
    }
    */

    const attrList = [];
    function emitAttr (index, suffix) {
      suffix = suffix || '';
      const attrOutName = attrName + suffix
      attrList.push(attrOutName);

      if (isEndpoints) {
        const instanceStride = usage & ATTR_USAGE.PER_INSTANCE ? 1 : 3;
        attrSpecs[attrOutName] = {
          buffer: regl.prop(`buffers.${attrName}.buffer`),
          offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * (((props.isStartCap || !props.split)? 0 : 3) + index),
          stride: (ctx, props) => props.buffers[attrName].stride * instanceStride * (props.split ? 2 : 1),
          divisor: (ctx, props) => props.buffers[attrName].divisor,
        };
      } else {
        attrSpecs[attrOutName] = {
          buffer: regl.prop(`buffers.${attrName}.buffer`),
          offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * index,
          stride: (ctx, props) => props.buffers[attrName].stride,
          divisor: (ctx, props) => props.buffers[attrName].divisor,
        };
      }
    }

    if (usage & ATTR_USAGE.PER_INSTANCE) {
      emitAttr(0);
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
