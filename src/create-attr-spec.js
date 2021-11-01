module.exports = createAttrSpecs;

const GLSL_TYPES = require('./glsltypes.js');

function createAttrSpecs (meta, regl, isEndpoints) {
  const suffixes = isEndpoints ? ['B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
  const attrLines = [];
  const attrSpecs = {};
  meta.attrs.forEach((attr, attrName) => {
    const attrList = [];
    for (let i = 0; i < suffixes.length; i++) {
      const suffix = suffixes[i];
      if (!attr.includeAdjacent && (suffix === 'A' || suffix === 'D')) continue;
      const attrOutName = attrName + suffixes[i]
      attrList.push(attrOutName);

      if (isEndpoints) {
        attrSpecs[attrOutName] = {
          buffer: regl.prop(`buffers.${attrName}.buffer`),
          offset: (ctx, props) => {
            return props.buffers[attrName].offset + props.buffers[attrName].stride * ((props.isStartCap ? 0 : 3) + i);
          },
          stride: (ctx, props) => {
            return props.buffers[attrName].stride * 6;
          },
          divisor: 1,
        };
      } else {
        attrSpecs[attrOutName] = {
          buffer: regl.prop(`buffers.${attrName}.buffer`),
          offset: (ctx, props) => props.buffers[attrName].offset + props.buffers[attrName].stride * i,
          stride: (ctx, props) => props.buffers[attrName].stride,
          divisor: 1,
        };
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
