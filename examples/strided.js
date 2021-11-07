const regl = createREGL({
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    uniform float pixelRatio;

    #pragma lines: attribute vec2 xy;
    #pragma lines: attribute vec3 color;
    #pragma lines: attribute float width;
    #pragma lines: position = getPosition(xy);
    #pragma lines: varying vec3 color = getColor(color);
    #pragma lines: width = getWidth(width);

    vec4 getPosition(vec2 xy) { return vec4(xy, 0, 1); }
    vec3 getColor(vec3 color) { return color; }
    float getWidth(float width) { return pixelRatio * width; }
  `,
  frag: `
    precision lowp float;
    varying vec3 color;
    void main () {
      gl_FragColor = vec4(color, 1);
    }`,
  uniforms: {
    pixelRatio: regl.context('pixelRatio')
  }
});

// Construct an array of xy pairs
const n = 101;
const vertices = [];
for (let i = 0; i < n; i++) {
  let t = i / (n - 1);
  let x = (t * 2 - 1) * 0.8;
  let y = 0.8 * Math.sin(x * 2.0 * Math.PI);
  let width = 50.0 * (0.5 - 0.4 * Math.cos(Math.PI * 4 * x));

  // x, y (float32): bytes 0-7
  // width (float32): bytes 8-11
  // color (float32): bytes 12-23
  vertices.push([
    x, y,
    width,
    ...[0, 1, 2].map(i => 0.5 + Math.cos(2 * (x - 2 * i * Math.PI / 3)))
  ]);
}

// Pack the interleaved values into a buffer
const verticesBuffer = regl.buffer(vertices);
const endpointsBuffer = regl.buffer([vertices.slice(0, 3), vertices.slice(-3).reverse()]);

// Set up the data to be drawn.
const lineData = {
  join: 'round',
  cap: 'round',
  vertexCount: n,
  vertexAttributes: {
    // Attributes are compatible with regl specification
    xy: {
      buffer: verticesBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 0,
      stride: Float32Array.BYTES_PER_ELEMENT * 6,
      // divisor: 1 // implicit (but configurable)
    },
    width: {
      buffer: verticesBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 2,
      stride: Float32Array.BYTES_PER_ELEMENT * 6
    },
    color: {
      buffer: verticesBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 3,
      stride: Float32Array.BYTES_PER_ELEMENT * 6
    }
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: {
      buffer: endpointsBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 0,
      stride: Float32Array.BYTES_PER_ELEMENT * 6
    },
    width: {
      buffer: endpointsBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 2,
      stride: Float32Array.BYTES_PER_ELEMENT * 6
    },
    color: {
      buffer: endpointsBuffer,
      offset: Float32Array.BYTES_PER_ELEMENT * 3,
      stride: Float32Array.BYTES_PER_ELEMENT * 6
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
