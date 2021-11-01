'use strict';

module.exports = sanitizeBufferInput;

const DTYPE_SIZES = require('./dtypesizes.js');
const DTYPES = require('./dtypes.json');

function sanitizeBufferInput (metadata, buffersObj, kind) {
  const outputs = {};

  if (!buffersObj) return outputs;

  for (let [attrName, attrMeta] of metadata.attrs) {
    const input = buffersObj[attrName];

    const output = {
      buffer: null,
      dimension: attrMeta.dimension,
      offset: 0,
      type: NaN,
      stride: NaN,
      bytesPerElement: NaN
    };

    if (!input) {
      throw new Error(`Missing line ${kind} buffer for attribute '${attrName}'`);
    } else if (input._reglType === 'buffer') {
      output.buffer = input;
      output.type = output.buffer._buffer.dtype
    } else if (input.buffer._reglType === 'buffer') {
      output.buffer = input.buffer;

      if (input.hasOwnProperty('dimension') && input.dimension !== output.dimension) {
        throw new Error(`Size of attribute (${input.dimension}) does not match dimension specified in shader pragma (${attrMeta.dimension})`);
      }
      if (input.hasOwnProperty('offset')) output.offset = input.offset;
      if (input.hasOwnProperty('type')) {
        output.type = DTYPES[input.type];
      } else {
        output.type = output.buffer._buffer.dtype
      }
      if (input.hasOwnProperty('stride')) output.stride = input.stride;
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
