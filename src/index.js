'use strict';

const createDrawMiterSegmentCommand = require('./draw-miter-segment.js');
const createDrawMiterCapCommand = require('./draw-miter-cap.js');
const createDrawRoundedSegmentCommand = require('./draw-rounded-segment.js');
const createDrawRoundedCapCommand = require('./draw-rounded-segment-cap.js');
const parseShaderPragmas = require('./parse-pragmas.js');
const sanitizeBufferInputs = require('./sanitize-buffer.js');
const createAttrSpec = require('./create-attr-spec.js');
const sanitizeInclusionInList = require('./sanitize-in-list.js');

module.exports = createDrawLines;

function createDrawLines(
  regl,
  {
    vert = null,
    frag = null,
    debug = false
  } = {}
) {
  if (!vert) throw new Error('Missing vertex shader, `vert`');
  if (!frag) throw new Error('Missing fragment shader, `frag`');

  const meta = parseShaderPragmas(vert);
  const segmentSpec = createAttrSpec(meta, regl, false);
  const endpointSpec = createAttrSpec(meta, regl, true);

  const configureLineRendering = regl({
    uniforms: {
      resolution: ctx => [ctx.viewportWidth, ctx.viewportHeight],
    },
    cull: {enable: false},
  });

  // Round geometry is used for both joins and end caps. We use an integer
  // and divide by the resolution in the shader so that we can allocate a
  // single, fixed buffer and the resolution is entirely a render-time decision.
  //
  // This value is chosen for aesthetic reasons, but also because there seems to be
  // a loss of precision or something above 30 at which it starts to get the indices
  // wrong.
  const MAX_ROUND_JOIN_RESOLUTION = 30;
  let indexBuffer, indexPrimitive, indexElements, indexBarycentric;
  const indexAttributes = {};
  if (debug) {
    indexPrimitive = 'triangles';
    indexBuffer = regl.buffer(
      [...Array(MAX_ROUND_JOIN_RESOLUTION * 4).keys()].map(i =>
        [
          [2 * i, 2 * i + 1, 2 * i + 2],
          [2 * i + 2, 2 * i + 1, 2 * i + 3]
        ].flat()
      )
    );
    indexAttributes.indexBarycentric = {
      divisor: 0,
      buffer: regl.buffer(
        [...new Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 3).keys()]
          .map(() => [[0, 0], [1, 0], [0, 1]])
          .flat()
      )
    };
    indexAttributes.debugInstanceID = {
      divisor: 1,
      buffer: regl.buffer(new Uint16Array([...Array(10000).keys()]))
    };
  } else {
    indexPrimitive = 'triangle strip';
    indexBuffer = regl.buffer(
      new Int8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 5).keys()])
    );
  }
  indexAttributes.index = { buffer: indexBuffer, divisor: 0 };

  // Instantiate commands
  const config = {regl, meta, segmentSpec, endpointSpec, frag, indexBuffer, indexPrimitive, indexAttributes, debug};
  const drawMiterSegment = createDrawMiterSegmentCommand(config);
  const drawMiterCap = createDrawMiterCapCommand(config);
  const drawRoundedSegment = createDrawRoundedSegmentCommand(config);
  const drawRoundedCap = createDrawRoundedCapCommand(config);

  const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
  const VALID_CAP_TYPES = ['round', 'square', 'none'];
  const ROUND_CAP_SCALE = [1, 1];
  const SQUARE_CAP_SCALE = [2 / Math.sqrt(3), 2];

  return function drawLines(props) {
    if (!props) return;
    if (!Array.isArray(props)) props = [props];

    const allRoundedSegments = [];
    const allRoundedCaps = [];
    const allMiterSegments = [];
    const allMiterCaps = [];

    for (const line of props) {
      const vertexAttributes = sanitizeBufferInputs(meta, line.vertexAttributes, false);
      const endpointAttributes = sanitizeBufferInputs(meta, line.endpointAttributes, true);

      const joinType = sanitizeInclusionInList(line.join, 'miter', VALID_JOIN_TYPES, 'join');
      const capType = sanitizeInclusionInList(line.cap, 'square', VALID_CAP_TYPES, 'cap');

      const joinResolution = line.joinResolution === undefined ? 8 : line.joinResolution;
      let capResolution = line.capResolution === undefined ? 12 : line.capResolution;;
      if (capType === 'square') {
        capResolution = 3;
      } else if (capType === 'none') {
        capResolution = 1;
      }

      const miterLimit = line.miterLimit === undefined ? 4 : line.miterLimit;
      const capScale = capType === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;

      let endpointProps, segmentProps;
      let splitEndpoints = true;

      if (line.endpointAttributes) {
        endpointProps = {
          buffers: endpointAttributes,
          count: line.endpointCount,
          joinResolution,
          capResolution,
          capScale,
          miterLimit,
        };
        splitEndpoints = !!meta.startcap;
      }

      if (line.vertexAttributes) {
        segmentProps = {
          buffers: vertexAttributes,
          count: line.vertexCount,
          joinResolution,
          capResolution,
          miterLimit
        }
      }

      switch (joinType) {
        case 'round':
          if (line.vertexAttributes) {
            allRoundedSegments.push(segmentProps);
          }
          if (line.endpointAttributes) {
            if (meta.startcap) {
              allRoundedCaps.push({...endpointProps, split: false});
            } else {
              allRoundedCaps.push(
                {...endpointProps, isStartCap: 1, split: true},
                {...endpointProps, isStartCap: 0, split: true},
              );
            }
          }
          break;

        case 'bevel':
          segmentProps.miterLimit = 1;
          endpointProps.miterLimit = 1;
        case 'miter':
          if (line.vertexAttributes) {
            allMiterSegments.push(segmentProps);
          }
          if (line.endpointAttributes) {
            if (meta.startcap) {
              allMiterCaps.push({...endpointProps, split: false});
            } else {
              allMiterCaps.push(
                {...endpointProps, isStartCap: 1, split: true},
                {...endpointProps, isStartCap: 0, split: true}
              );
            }
          }
      }
    }

    configureLineRendering(() => {
      if (allRoundedSegments.length) drawRoundedSegment(allRoundedSegments);
      if (allMiterSegments.length) drawMiterSegment(allMiterSegments);
      if (allRoundedCaps.length) drawRoundedCap(allRoundedCaps);
      if (allMiterCaps.length) drawMiterCap(allMiterCaps);
    });
  };
}
