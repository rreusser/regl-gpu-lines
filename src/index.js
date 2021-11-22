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

const FORBIDDEN_REGL_PROPS = new Set(['attributes', 'elements']);
const VALID_JOIN_TYPES = ['round', 'bevel', 'miter'];
const VALID_CAP_TYPES = ['round', 'square', 'none'];
const ROUND_CAP_SCALE = [1, 1];
const SQUARE_CAP_SCALE = [2, 2 / Math.sqrt(3)];
// Max possible is 62, but we probably don't need that many
const MAX_ROUND_JOIN_RESOLUTION = 32;
const MAX_DEBUG_VERTICES = 16384;

const FEATUREMASK_IS_ENDPOINTS = 1 << 0;
const FEATUREMASK_INSERT_CAPS = 1 << 1;
const FEATUREMASK_VAO = 1 << 2;
function getCacheKey (isEndpoints, insertCaps, isVAO) {
  return (isEndpoints ? FEATUREMASK_IS_ENDPOINTS : 0)
    + (insertCaps ? FEATUREMASK_INSERT_CAPS : 0)
    + (isVAO ? FEATUREMASK_VAO : 0);
}

function reglLines(
  regl,
  opts = {}
) {
  const {
    vert = null,
    frag = null,
    debug = false,
    reorder = false,
  } = opts;

  if (!regl._gpuLinesCache) regl._gpuLinesCache = {};
  const cache = regl._gpuLinesCache;

  // Forward all regl parameters except for vert and frag and a couple forbidden parameters along to regl.
  const forwardedCmdConfig = {...opts};
  const forwardedUniforms = opts.uniforms || {};
  for (const prop of ['vert', 'frag', 'debug', 'reorder', 'uniforms']) delete forwardedCmdConfig[prop];
  const forwarded = Object.keys(forwardedCmdConfig);
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

  const indexAttributes = [];
  if (debug) {
    // TODO: Allocate/grow lazily to avoid an arbitrary limit
    if (!cache.debugInstanceIDBuffer) {
      cache.debugInstanceIDBuffer = regl.buffer(new Uint16Array([...Array(MAX_DEBUG_VERTICES).keys()]));
    }
    indexAttributes.push({
      name: 'debugInstanceID',
      spec: { buffer: cache.debugInstanceIDBuffer, divisor: 1 }
    });
  }
  if (!cache.indexBuffer) {
    cache.indexBuffer = regl.buffer(new Uint8Array([...Array(MAX_ROUND_JOIN_RESOLUTION * 4 + 6).keys()]));
  }
  indexAttributes.push({
    name: 'index',
    spec: { buffer: cache.indexBuffer, divisor: 0 }
  });

  const sanitizeJoinType = sanitizeInclusionInList('join', VALID_JOIN_TYPES, 'miter');
  const sanitizeCapType = sanitizeInclusionInList('cap', VALID_CAP_TYPES, 'square');

  const drawCommands = new Map();
  function getDrawCommand(featureMask) {
    if (!drawCommands.has(featureMask)) {
      drawCommands.set(featureMask, createDrawSegment(
        regl,
        featureMask & FEATUREMASK_IS_ENDPOINTS,
        featureMask & FEATUREMASK_INSERT_CAPS,
        featureMask & FEATUREMASK_VAO,
        meta,
        frag,
        segmentSpec,
        endpointSpec,
        indexAttributes,
        forwardedCmdConfig,
        forwardedUniforms,
        debug
      ));
    }
    return drawCommands.get(featureMask);
  }

  const drawQueue = [];
  function queue(...propsList) {
    drawQueue.push.apply(drawQueue, propsList);
  }
  function flushDrawQueue () {
    // Sort by the identifier of the draw command so group together commands using the same shader
    if (reorder) drawQueue.sort(function (a, b) { return a.featureMask - b.featureMask; });
    let pos = 0;
    const groupedProps = [];

    // Iterate through the queue. Group props until the command changes, then draw and continue
    while(pos < drawQueue.length) {
      const {featureMask, props} = drawQueue[pos];
      groupedProps.push(props);
      while (++pos < drawQueue.length && drawQueue[pos].featureMask === featureMask) {
        groupedProps.push(drawQueue[pos].props);
      }
      // console.log('isEndpoints:', !!(FEATUREMASK_IS_ENDPOINTS & featureMask), 'insertCaps:', !!(FEATUREMASK_INSERT_CAPS & featureMask), 'batching:', groupedProps.length);
      getDrawCommand(featureMask)(groupedProps);
      groupedProps.length = 0;
    }
    drawQueue.length = 0;
  }

  const returnValue = function drawLines(props) {
    if (!props) return;
    if (!Array.isArray(props)) props = [props];

    for (const userProps of props) {
      const join = sanitizeJoinType(userProps.join);
      const cap = sanitizeCapType(userProps.cap);

      const isVAO = !!userProps.vao;

      let capRes2 = userProps.capResolution === undefined ? 12 : userProps.capResolution;
      if (cap === 'square') {
        capRes2 = 3;
      } else if (cap === 'none') {
        capRes2 = 1;
      }

      let joinRes2 = 1;
      if (join === 'round') {
        joinRes2 = userProps.joinResolution === undefined ? 8 : userProps.joinResolution;
      }

      // We only ever use these in doubled-up form
      capRes2 *= 2;
      joinRes2 *= 2;

      const miterLimit = join === 'bevel' ? 1 : (userProps.miterLimit === undefined ? 4 : userProps.miterLimit);
      const capScale = cap === 'square' ? SQUARE_CAP_SCALE : ROUND_CAP_SCALE;
      const insertCaps = !!userProps.insertCaps;
      const sharedProps = {joinRes2, capRes2, capScale, join, miterLimit, insertCaps};

      if (userProps.endpointCount) {
        const endpointProps = {
          count: userProps.endpointCount,
          ...userProps,
          ...sharedProps
        };
        let featureMask = getCacheKey(true, insertCaps, isVAO);
        if (isVAO) {
          if (meta.orientation) {
            const vao = {vao: endpointProps.vao.endpoints};
            queue({featureMask, props: {...endpointProps, ...vao}});
          } else {
            const startVao = {vao: endpointProps.vao.startCaps};
            const endVao = {vao: endpointProps.vao.endCaps};
            queue(
              {featureMask, props: {...endpointProps, ...startVao, orientation: ORIENTATION.CAP_START, splitCaps: true}},
              {featureMask, props: {...endpointProps, ...endVao, orientation: ORIENTATION.CAP_END, splitCaps: true}},
            );
          }
        } else {
          endpointProps.buffers = sanitizeBufferInputs(meta, userProps.endpointAttributes, true);
          if (meta.orientation) {
            queue({featureMask, props: {...endpointProps, splitCaps: false}});
          } else {
            queue(
              {featureMask, props: {...endpointProps, orientation: ORIENTATION.CAP_START, splitCaps: true}},
              {featureMask, props: {...endpointProps, orientation: ORIENTATION.CAP_END, splitCaps: true}}
            );
          }
        }
      }

      if (userProps.vertexCount) {
        const featureMask = getCacheKey(false, insertCaps, isVAO);
        const props = {
          count: userProps.vertexCount,
          ...userProps,
          ...sharedProps
        };
        if (isVAO) {
          props.vao = userProps.vao.vertices;
        } else {
          props.buffers = sanitizeBufferInputs(meta, userProps.vertexAttributes, false);
        }
        queue({featureMask, props});
      }

      flushDrawQueue();
    }
  };

  returnValue.vao = function (props) {
    const outputs = {};
    const cases = [['vertices', segmentSpec.attrs, props.vertexAttributes, false]];
    if (meta.orientation) {
      cases.push(['endpoints', endpointSpec.attrs, props.endpointAttributes, true, false, null]);
    } else {
      cases.push(
        ['startCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_START],
        ['endCaps', endpointSpec.attrs, props.endpointAttributes, true, true, ORIENTATION.CAP_END]
      );
    }
    for (const [outputName, specAttrs, attrs, isEndpoints, splitCaps, orientation] of cases) {
      if (!attrs) continue;
      const fakeProps = {
        buffers: sanitizeBufferInputs(meta, attrs, isEndpoints),
        splitCaps,
        orientation
      };
      const vaoData = [];
      for(const attr of indexAttributes.concat(specAttrs)) {
        const vaoEntry = {};
        for (const item of ['buffer', 'divisor', 'offset', 'stride', 'normalized', 'dimension']) {
          let value = attr.spec[item];
          if (value && value.data) value = value.data;
          if (typeof value === 'function') value = value({}, fakeProps);
          if (value !== undefined) vaoEntry[item] = value;
        }
        vaoData.push(vaoEntry);
      }
      outputs[outputName] = regl.vao(vaoData);
    }
    outputs.destroy = function destroy () {
      for (const [outputName] of cases) {
        if (!outputs[outputName]) continue;
        outputs[outputName].destroy();
        delete outputs[outputName];
      }
    };
    return outputs;
  };

  return returnValue;
}
