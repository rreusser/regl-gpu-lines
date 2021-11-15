'use strict';

const createDrawSegment = require('./draw-segment.js');
const parseShaderPragmas = require('./parse-pragmas.js');
const sanitizeBufferInputs = require('./sanitize-buffer.js');
const createAttrSpec = require('./create-attr-spec.js');
const sanitizeInclusionInList = require('./sanitize-in-list.js');
const ORIENTATION = require('./constants/orientation.json');

module.exports = reglLines;

reglLines.CAP_START = ORIENTATION.CAP_START;
reglLines.CAP_END = ORIENTATION.CAP_END;

const FORBIDDEN_REGL_PROPS = new Set(['count', 'instances', 'attributes', 'elements']);
const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
const VALID_CAP_TYPES = ['round', 'square', 'none'];
const ROUND_CAP_SCALE = [1, 1];
const SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)];
const MAX_ROUND_JOIN_RESOLUTION = 30;
const MAX_DEBUG_VERTICES = 16384;

function reglLines(
  regl,
  opts = {}
) {
  const {
    vert = null,
    frag = null,
    debug = false,
    autoCaps = false,
  } = opts;

  // Forward all regl parameters except for vert and frag along to regl.
  const forwardedCmdConfig = {...opts};
  for (const prop of ['vert', 'frag', 'debug', 'autoCaps']) delete forwardedCmdConfig[prop];
  const forwarded = Object.keys(forwardedCmdConfig);
  const canReorder = forwarded.length === 0;
  forwarded.forEach(fwd => {
    if (FORBIDDEN_REGL_PROPS.has(fwd)) {
      throw new Error(`Invalid parameter '${fwd}'. Parameters ${[...FORBIDDEN_REGL_PROPS].map(p => `'${p}'`).join(', ')} may not be forwarded to regl.`);
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

  const userConfig = canReorder ? (props, cb) => cb() : regl(forwardedCmdConfig);

  const indexAttributes = {};
  if (debug) {
    // TODO: Allocate/grow lazily to avoid an arbitrary limit
    indexAttributes.debugInstanceID = {
      buffer: regl.buffer(new Uint16Array([...Array(MAX_DEBUG_VERTICES).keys()])),
      divisor: 1
    };
  }
  indexAttributes.index = {
    buffer: regl.buffer(new Int8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 6 + 4).keys()])),
    divisor: 0
  };

  // Instantiate commands
  const config = {regl, meta, segmentSpec, endpointSpec, frag, indexAttributes, debug, autoCaps};
  const drawMiterSegment = createDrawSegment(false, false, config);
  const drawRoundedSegment = createDrawSegment(true, false, config);
  const drawMiterCap = createDrawSegment(false, true, config);
  const drawRoundedCap = createDrawSegment(true, true, config);

  const sanitizeJoinType = sanitizeInclusionInList('join', VALID_JOIN_TYPES, 'miter');
  const sanitizeCapType = sanitizeInclusionInList('cap', VALID_CAP_TYPES, 'square');

  const allRoundedSegments = [];
  const allRoundedCaps = [];
  const allMiterSegments = [];
  const allMiterCaps = [];

  function flush (props) {
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

  return function drawLines(props) {
    if (!props) return;
    const isArrayProps = Array.isArray(props);
    if (!isArrayProps) props = [props];
    const reorder = canReorder && !isArrayProps;

    setResolution(() => {
      for (const lineProps of props) {

        const joinType = sanitizeJoinType(lineProps.join);
        const capType = sanitizeCapType(lineProps.cap);

        let capResolution = lineProps.capResolution === undefined ? 12 : lineProps.capResolution;
        if (capType === 'square') {
          capResolution = 3;
        } else if (capType === 'none') {
          capResolution = 1;
        }
        let joinResolution = 1;
        if (joinType === 'round') joinResolution = lineProps.joinResolution === undefined ? 8 : lineProps.joinResolution;

        const miterLimit = joinType === 'bevel' ? 1 : (lineProps.miterLimit === undefined ? 4 : lineProps.miterLimit);
        const capScale = capType === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;

        const sharedProps = { joinResolution, capResolution, capScale, capType, miterLimit };

        if (lineProps.endpointAttributes && lineProps.endpointCount) {
          const endpointProps = {
            buffers: sanitizeBufferInputs(meta, lineProps.endpointAttributes, true),
            count: lineProps.endpointCount,
            ...sharedProps
          };
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

        if (lineProps.vertexAttributes && lineProps.vertexCount) {
          const segmentDst = joinType === 'round' ? allRoundedSegments : allMiterSegments;
          segmentDst.push({
            buffers: sanitizeBufferInputs(meta, lineProps.vertexAttributes, false),
            count: lineProps.vertexCount,
            ...sharedProps
          });
        }

        if (!reorder) flush(lineProps);
      }

      if (reorder) flush(props);
    });
  };
}
