'use strict';

const createDrawMiterSegmentCommand = require('./draw-miter-segment.js');
const createDrawMiterCapCommand = require('./draw-miter-cap.js');
const createDrawRoundedSegmentCommand = require('./draw-rounded-segment.js');
const createDrawRoundedCapCommand = require('./draw-rounded-cap.js');
const parseShaderPragmas = require('./parse-pragmas.js');
const sanitizeBufferInputs = require('./sanitize-buffer.js');
const createAttrSpec = require('./create-attr-spec.js');
const sanitizeInclusionInList = require('./sanitize-in-list.js');
const ORIENTATION = require('./orientation.json');

module.exports = reglLines;

reglLines.CAP_START = ORIENTATION.CAP_START
reglLines.CAP_END = ORIENTATION.CAP_END

const FORBIDDEN_PROPS = new Set(['count', 'instances', 'attributes', 'elements']);

function reglLines(
  regl,
  opts = {}
) {
  const {
    vert = null,
    frag = null,
    debug = false
  } = opts;

  // Forward all regl parameters except for vert and frag along to regl. Additionally,
  // extract uniform separately so that we can merge them with the resolution uniform
  const forwardedOpts = {...opts};
  for (const prop of ['vert', 'frag', 'debug']) delete forwardedOpts[prop];
  const forwarded = Object.keys(forwardedOpts)
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
      resolution: ctx => [ctx.viewportWidth, ctx.viewportHeight],
    }
  });

  const userConfig = canReorder ? (props, cb) => cb() : regl(forwardedOpts);

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
    const isArrayProps = Array.isArray(props);
    if (!isArrayProps) props = [props];
    const reorder = canReorder && !isArrayProps;

    const allRoundedSegments = [];
    const allRoundedCaps = [];
    const allMiterSegments = [];
    const allMiterCaps = [];
    function flush (props) {
      userConfig(props, () => {
        //if (allRoundedSegments.length) drawRoundedSegment(allRoundedSegments);
        //if (allMiterSegments.length) drawMiterSegment(allMiterSegments);
        if (allRoundedCaps.length) drawRoundedCap(allRoundedCaps);
        //if (allMiterCaps.length) drawMiterCap(allMiterCaps);
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

        const joinResolution = lineProps.joinResolution === undefined ? 8 : lineProps.joinResolution;
        let capResolution = lineProps.capResolution === undefined ? 12 : lineProps.capResolution;;
        if (capType === 'square') {
          capResolution = 3;
        } else if (capType === 'none') {
          capResolution = 1;
        }

        const miterLimit = joinType === 'bevel' ? 1 : (lineProps.miterLimit === undefined ? 4 : lineProps.miterLimit);
        const capScale = capType === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;

        let endpointProps, segmentProps;
        let splitEndpoints = true;

        if (lineProps.endpointAttributes) {
          endpointProps = {
            buffers: endpointAttributes,
            count: lineProps.endpointCount,
            joinResolution,
            capResolution,
            capScale,
            miterLimit,
          };
          splitEndpoints = !!meta.orientation;
        }

        if (lineProps.vertexAttributes) {
          segmentProps = {
            buffers: vertexAttributes,
            count: lineProps.vertexCount,
            joinResolution,
            capResolution,
            miterLimit
          }
        }

        if (segmentProps) {
          const segmentDst = joinType === 'round' ? allRoundedSegments : allMiterSegments;
          segmentDst.push(segmentProps);
        }

        if (endpointProps) {
          const endpointDst = joinType === 'round' ? allRoundedCaps : allMiterCaps;
          if (meta.orientation) {
            endpointDst.push({...endpointProps, splitCaps: false});
          } else {
            endpointDst.push(
              {...endpointProps, orientation: ORIENTATION.CAP_START, splitCaps: true},
              {...endpointProps, orientation: ORIENTATION.CAP_END, splitCaps: true}
            );
          }
        }

        if (!reorder) flush(lineProps);
      }

      if (reorder) flush(props);
    });
  };
}
