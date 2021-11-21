const regl = createREGL({extensions: ['ANGLE_instanced_arrays']});

// This example illustrates use of batching to reduce the number of shader program changes from
// thirty to just four--though the number of draw calls remains unchanged. This applies when each line
// has its own buffers and requires a separate draw call. Since some of the options (endpoints vs.
// interior segments and whether ot insert caps) need to be known at command *compile* time, it's
// possible to draw lines in a manner which switches the draw program many times.
//
// When using regl, you may invoke commands independently, e.g.
//
//    drawLines({...})
//    drawLines({...})
//    drawLines({...})
//
// or batched as an array, e.g.
//
//    drawLines([{...}, {...}, ...])
//
// The latter form allows regl to bypass some state change checks.
//
// This library performs the additional step of *reordering* draw commands to group together draw calls
// using the same shader program. It only applies when called with array of props. This option is
// *enabled* by default. It may be disabled by specifying `reorder = false`, avoided by independently
// invoking draw calls, or its potential side effects mitigated by using depth to enforce ordering of
// opaque objects.
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    #pragma lines: width = getWidth();
    uniform float pixelRatio;

    vec4 getPosition(vec2 xy) {
      return vec4(xy, 0, 1);
    }
    float getWidth() { return 20.0 * pixelRatio; }
    vec2 getXY(vec2 xy) { return xy; }`,
  frag: `
    precision lowp float;
    uniform vec3 color;
    void main () {
      gl_FragColor = vec4(color, 0.7);
    }`,

  // Extra config passed to the draw command
  depth: { enable: false },
  cull: {enable: true, face: 'back'},
  blend: {
    enable: true,
    func: { srcRGB: "src alpha", srcAlpha: 1, dstRGB: "one minus src alpha", dstAlpha: 1 }
  },
  uniforms: {
    pixelRatio: regl.context('pixelRatio'),
    color: regl.prop('color')
  }
});

const n = 20;
const lineCount = 15;

function xy (line, i) {
  let t = (i / (n - 1) * 2 - 1) * 0.9;
  const y = ((line + 0.5) / lineCount * 2 - 1) * 0.9;
  return [t, y + 1.5 / lineCount * Math.sin((t - line * 0.2) * 30.0)];
}

// Construct independent sets of props, to be passed as an array and rendered in one pass.
// When called in this fashion, all lines using the same draw command will be batched together.
// The key compile-time variables affecting this are:
//   - insertCaps: insert caps to fill NaN gaps
//   - isEndpoints: true when rendering dedicated, separately-provided endpoint instances
// This may affect layering if depth is disabled. To get around this, you may simply invoke
// rendering independently for each line.
const lineList = [];
for (let line = 0; line < lineCount; line++) {
  const positions = [];
  for (let i = 0; i < n; i++) {
    positions.push(i === Math.floor(n / 2) ? [NaN, NaN] : xy(line, i));
  }
  lineList.push({
    color: [0, 1, 2].map(i => 0.5 + Math.cos((i / 3 + (line / lineCount)) * Math.PI * 2)),
    cap: line % 2 === 0 ? 'round' : 'square',
    join: line % 4 === 0 ? 'miter' : 'round',
    insertCaps: line % 3 === 0,
    vertexCount: positions.length,
    endpointCount: 2,
    vertexAttributes: {
      xy: regl.buffer(positions)
    },
    endpointAttributes: {
      xy: regl.buffer([positions.slice(0, 3), positions.slice(-3).reverse()])
    }
  });
}

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineList);
}

draw();
window.addEventListener('resize', draw);
