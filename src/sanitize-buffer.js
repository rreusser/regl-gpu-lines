'use strict';

module.exports = sanitizeBufferInput;

const DTYPE_SIZES = require('./constants/dtypesizes.js');
const DTYPES = require('./constants/dtypes.json');

function has(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

// This function is run on every draw call in order to sanitize and configure the data layout
function sanitizeBufferInput (metadata, buffersObj, isEndpoints) {
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
