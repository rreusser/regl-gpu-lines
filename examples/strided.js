const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    uniform float pixelRatio;

    #pragma lines: attribute vec2 xy;
    #pragma lines: attribute vec4 color;
    #pragma lines: attribute float width;
    #pragma lines: position = getPosition(xy);
    #pragma lines: varying vec4 color = getColor(color);
    #pragma lines: width = getWidth(width);

    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    vec4 getColor(vec4 color) { return color; }
    float getWidth(float width) { return pixelRatio * width; }
  `,
  frag: `
    precision lowp float;
    varying vec4 color;
    void main () {
      gl_FragColor = color;
    }`,
  uniforms: {
    pixelRatio: regl.context('pixelRatio')
  }
});

// Construct an array of xy pairs
const n = 101;
const verticesU8 = new Uint8ClampedArray(n * 16);
const verticesF32 = new Float32Array(verticesU8.buffer);
for (let i = 0; i < n; i++) {
  let t = i / (n - 1);
  let x = (t * 2 - 1) * 0.8;
  let y = 0.8 * Math.sin(x * 2.0 * Math.PI);
  let width = 50.0 * (0.5 - 0.4 * Math.cos(Math.PI * 4 * x));
  let color = [0, 1, 2].map(i => 0.5 + Math.cos(2 * (x - 2 * i * Math.PI / 3)));

  // x, y (float32): bytes 0-7
  // width (float32): bytes 8-11
  // color (float32): bytes 12-23
  verticesF32[i * 4] = x;
  verticesF32[i * 4 + 1] = y;
  verticesF32[i * 4 + 2] = width;
  verticesU8[i * 16 + 12] = color[0] * 255;
  verticesU8[i * 16 + 13] = color[1] * 255;
  verticesU8[i * 16 + 14] = color[2] * 255;
  verticesU8[i * 16 + 15] = 255;
}

// Pack the interleaved values into a buffer
const verticesBuffer = regl.buffer(verticesU8);

// Packing the endpoints into a buffer is a little trickier. We need blocks of sixteen
// bytes for each vertex packed into an array for the first three vertices and the last
// three (in reverse order), so basically vertices [0, 1, 2] and [n-1, n-2, n-3].
const endpointsU8 = new Uint8Array(2 * 3 * 16);
for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 3; i++) {
        endpointsU8[i * 16 + j] = verticesU8[i * 16 + j];
        endpointsU8[(3 + i) * 16 + j] = verticesU8[(n - 1 - i) * 16 + j];
    }
}
const endpointsBuffer = regl.buffer(endpointsU8);

// Set up the data to be drawn.
const lineData = {
  join: 'round',
  cap: 'round',
  vertexCount: n,
  vertexAttributes: {
    // Attributes are compatible with regl specification
    xy: {
      type: 'float32',
      buffer: verticesBuffer,
      offset: 0,
      stride: 16,
      // divisor: 1 // implicit (but configurable)
    },
    width: {
      type: 'float32',
      buffer: verticesBuffer,
      offset: 8,
      stride: 16,
    },
    color: {
      type: 'uint8',
      normalized: true,
      buffer: verticesBuffer,
      offset: 12,
      stride: 16,
    }
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: {
      type: 'float32',
      buffer: endpointsBuffer,
      offset: 0,
      stride: 16,
    },
    width: {
      type: 'float32',
      buffer: endpointsBuffer,
      offset: 8,
      stride: 16,
    },
    color: {
      type: 'uint8',
      normalized: true,
      buffer: endpointsBuffer,
      offset: 12,
      stride: 16,
    }
  }
};

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
