const regl = createREGL({extensions: ['ANGLE_instanced_arrays']});

const drawLines = createDrawLines(regl, {
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 xy;
    #pragma lines: attribute float startcap;
    #pragma lines: position = getPosition(xy);
    #pragma lines: width = getWidth();
    #pragma lines: startcap = isStartCap(startcap);
    #pragma lines: varying float x = getX(xy);

    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    float getWidth() { return 10.0; }
    float getX(vec2 xy) { return xy.x; }
    bool isStartCap(float startcap) { return startcap > 0.0; }`,
  frag: `
    precision lowp float;
    varying float x;
    void main () {
      gl_FragColor = vec4(0.5 + cos(8.0 * (x - vec3(0, 1, 2) * 3.141 / 3.0)), 1);
    }`
});

const n = 51;
const lineCount = 10;
const positions = [];
const endpoints = [];
const isstart = [];

function xy (line, i) {
  let t = (i / (n - 1) * 2 - 1) * 0.9;
  const y = ((line + 0.5) / lineCount * 2 - 1) * 0.9;
  return [t, y + 1 / lineCount * Math.sin((t - line * 0.1) * 8.0)];
}

for (let line = 0; line < lineCount; line++) {
  for (let i = 0; i < n; i++) positions.push(xy(line, i));

  // Add a break in the line by using NaN
  positions.push([NaN, NaN]);

  // Push a start cap and and end cap for this segment
  for (let i = 0; i < 3; i++) endpoints.push(xy(line, i));
  for (let i = 0; i < 3; i++) endpoints.push(xy(line, n - 1 - i));
  isstart.push(1, 0);
}

// After this, render as normal!
const lineData = {
  join: 'round',
  cap: 'round',
  vertexCount: positions.length,
  vertexAttributes: {
    xy: regl.buffer(positions)
  },
  endpointCount: endpoints.length / 3,
  endpointAttributes: {
    xy: regl.buffer(endpoints),
    startcap: regl.buffer(isstart)
  }
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
