const regl = createREGL({extensions: ['ANGLE_instanced_arrays']});

const drawLines = reglLines(regl, {
  // Trigger the command to automatically insert caps at any break, signaled
  // by a position with (w = 0)
  insertCaps: true,

  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: attribute float break;
    #pragma lines: position = getPosition(xy, break);
    #pragma lines: width = getWidth();
    #pragma lines: varying vec2 pos = getXY(xy);

    // Return w = 0 wherever there's a break
    vec4 getPosition(vec2 xy, float isBreak) {
      if (isBreak > 0.0) return vec4(0);
      return vec4(xy, 0, 1);
    }
    float getWidth() { return 40.0; }
    vec2 getXY(vec2 xy) { return xy; }`,
  frag: `
    precision lowp float;
    varying vec2 pos;
    void main () {
      // Convert the x-coordinate into a color
      gl_FragColor = vec4(0.6 + 0.4 * cos(8.0 * (pos.x - vec3(0, 1, 2) * 3.141 / 3.0)), 0.7);
    }`,
  // Turn off depth and turn on blending to make it very clear if we accidentally
  // draw end caps twice
  depth: { enable: false },
  blend: {
    enable: true,
    func: { srcRGB: "src alpha", srcAlpha: 1, dstRGB: "one minus src alpha", dstAlpha: 1 }
  },
});

const n = 31;
const lineCount = 10;

// Detecting NaN in GLSL can be questionable, so we can just be verbose and use a separate
// attribute to indicate breaks.
const positions = [[0,0]];
const isBreak = [1];

function xy (line, i) {
  let t = (i / (n - 1) * 2 - 1) * 0.9;
  const y = ((line + 0.5) / lineCount * 2 - 1) * 0.9;
  return [t, y + 1 / lineCount * Math.sin((t - line * 0.1) * 8.0)];
}

for (let line = 0; line < lineCount; line++) {
  for (let i = 0; i < n; i++) {
    positions.push(xy(line, i));
    isBreak.push(0);
  }

  // Add a break in the line by using NaN
  positions.push([0,0]);
  isBreak.push(1);
}

// After this, render as normal!
const lineData = {
  join: 'round',
  cap: 'round',
  vertexCount: positions.length,
  vertexAttributes: {
    xy: regl.buffer(positions),
    break: regl.buffer(new Uint8Array(isBreak))
  },
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
