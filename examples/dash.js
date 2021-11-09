function vec2distance (a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

const pixelRatio = window.devicePixelRatio;

const regl = createREGL({
  pixelRatio,
  extensions: ['ANGLE_instanced_arrays']
});

// Instantiate a command for drawing lines
const drawLines = reglLines(regl, {
  vert: `
    precision highp float;

    // Use a vec2 attribute to construt the vec4 vertex position
    #pragma lines: attribute vec2 xy;
    #pragma lines: position = getPosition(xy);
    vec4 getPosition(vec2 xy) {
      return vec4(xy, 0, 1);
    }

    // Pass the distance without modification as a varying
    #pragma lines: attribute float dist;
    #pragma lines: varying float dist = getDist(dist);
    float getDist(float dist) {
      return dist;
    }

    // Return the line width from a uniorm
    #pragma lines: width = getWidth();
    uniform float width;
    float getWidth() {
      return width;
    }`,
  frag: `
    precision lowp float;
    varying float dist;
    uniform float dashLength;

    float linearstep (float a, float b, float x) {
      return clamp((x - a) / (b - a), 0.0, 1.0);
    }

    void main () {
      float dashvar = fract(dist / dashLength) * dashLength;
      gl_FragColor = vec4(vec3(
        linearstep(0.0, 1.0, dashvar)
        * linearstep(dashLength * 0.5 + 1.0, dashLength * 0.5, dashvar)
      ), 1);
    }`,
  // Multiply the width by the pixel ratio for consistent width
  uniforms: {
    width: (ctx, props) => ctx.pixelRatio * props.width,
    dashLength: (ctx, props) => ctx.pixelRatio * props.width * props.dashLength * 2.0,
  },
  depth: { enable: true },
  cull: { enable: false }
});

// Construct an array of xy pairs
const n = 11;
const path = [...Array(n).keys()]
  .map(i => (i / (n - 1) * 2.0 - 1.0) * 0.8)
  .map(t => [t, 0.5 * Math.sin(8.0 * t)]);

function project(point) {
  return [
    (0.5 + 0.5 * point[0]) * regl._gl.canvas.width,
    (0.5 + 0.5 * point[1]) * regl._gl.canvas.height
  ];
}

function computeCumulativeDistance (dist, points, project) {
  let prevPoint = project(points[0]);
  for (let i = 1; i < points.length; i++) {
    const point = project(points[i]);
    const d =  dist[i - 1] + vec2distance(point, prevPoint);
    dist[i] = d;
    prevPoint = point;
  }
  return dist;
}

const dist = Array(path.length).fill(0);
const distBuffer = regl.buffer(dist);
const endpointDistBuffer = regl.buffer(new Float32Array(6));
const pathBuffer = regl.buffer(path);
const endpointBuffer = regl.buffer(new Float32Array(6));

// Set up the data to be drawn. Note that we preallocate buffers and don't create
// them on every draw call.
const lineData = {
  width: 40,
  dashLength: 4,
  join: 'round',
  cap: 'round',
  vertexCount: path.length,
  vertexAttributes: {
    xy: regl.buffer(path),
    dist: distBuffer
  },
  endpointCount: 2,
  endpointAttributes: {
    xy: regl.buffer([path.slice(0, 3), path.slice(-3).reverse()]),
    dist: endpointDistBuffer
  }
};

function updateBuffers () {
  lineData.vertexAttributes.dist.subdata(dist);
  lineData.endpointAttributes.dist.subdata([dist.slice(0, 3), dist.slice(-3).reverse()]);
  lineData.vertexAttributes.xy.subdata(path);
  lineData.endpointAttributes.xy.subdata([path.slice(0, 3), path.slice(-3).reverse()]);
}

function draw () {
  updateBuffers();

  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1], depth: 1});
  drawLines(lineData);
}

window.addEventListener('mousemove', function (event) {
  const lastPoint = path[0];
  const newPoint = [
    event.offsetX / window.innerWidth * 2 - 1,
    -event.offsetY / window.innerHeight * 2 + 1
  ];
  const newDist = Math.hypot(
    window.innerWidth * (lastPoint[0] - newPoint[0]),
    window.innerHeight * (lastPoint[1] - newPoint[1])
  );
  if (newDist < Math.max(2, lineData.width * 0.5)) return;

  path.unshift(newPoint);
  dist.unshift(dist[0] - newDist);

  path.pop();
  dist.pop();

  draw();
});

computeCumulativeDistance(dist, path, project);
draw();

window.addEventListener('resize', function () {
  computeCumulativeDistance(dist, path, project);
  draw();
});
