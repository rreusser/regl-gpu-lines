const pixelRatio = window.devicePixelRatio;
const regl = createREGL({
  pixelRatio,
  extensions: [
    'ANGLE_instanced_arrays',
    'OES_standard_derivatives',
  ],
});

const debug = true;

const state = wrapGUI(State({
    capResolution: State.Slider(4, {min: 1, max: 30, step: 1}),
    joinResolution: State.Slider(3, {min: 1, max: 30, step: 1}),
    cap: State.Select('round', {options: ['round', 'square', 'none']}),
    join: State.Select('round', {options: ['round', 'miter', 'bevel']}),
    lineWidth: State.Slider(20, {min: 1, max: 100, step: 0.1}),
    //borderWidth: State.Slider(10, {min: 0, max: 5, step: 0.1}),
    opacity: State.Slider(0.8, {min: 0, max: 1, step: 0.01}),
    stretch: State.Slider(0.97, {min: 0.01, max: 2, step: 0.001}),
    flip: State.Slider(1, {min: -1, max: 1, step: 0.001}),
    miterLimit: State.Slider(8, {min: 1, max: 8, step: 0.01}),
    dashLength: State.Slider(1, {min: 0.5, max: 8, step: 0.1}),
    //dashLength: State.Slider(1, {min: 0.1, max: 2, step: 0.1}),
    //n: State.Slider(11, {min: 3, max: 101, step: 1}),
    depth: false,
    cull: false,
  })
);
state.$onChange(() => {
  const progress = computeCumulativeDistance(points, p => [
    (p[0] * Math.pow(state.stretch, 4.0) - 0.2) * window.innerWidth,
    (p[1] * state.flip) * window.innerHeight,
  ]);
  progressBuffer.subdata(progress.flat());
  endpointProgressBuffer.subdata([progress.slice(0, 3), progress.slice(-3).reverse()].flat());
  draw();
})
window.addEventListener('resize', () => draw());

function computeCumulativeDistance (points, project) {
  const pproj = points.map(project);
  const dist = [0];
  for (let i = 1; i < pproj.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(
      pproj[i][0] - pproj[i - 1][0],
      pproj[i][1] - pproj[i - 1][1]
    ))
  }
  let dashLen = state.dashLength * state.lineWidth * pixelRatio;
  const dashCount = Math.round((dist[dist.length - 1] - dist[0]) / dashLen);
  const scaleFactor = dashCount % 2 === 1 ? (dashCount + 1) / dashCount : 1;
  return dist.map(d => dashLen * (Math.round(d * scaleFactor / dashLen) + 0.5));
}

const points = [[-0.75, -0.25], [-0.5, -0.6], [-0.25, 0.5], [0.0, -0.5], [0.25, 0.45], [0.5, 0.5], [0.75, 0.0]];
const widths = [1, 2, 0.7, 1.2, 1.5, 2, 1];
const index = [...new Array(500).keys()];
const progress = computeCumulativeDistance(points, p => [
  (p[0] * Math.pow(state.stretch, 4.0) - 0.2) * window.innerWidth,
  (p[1] * state.flip) * window.innerHeight,
]);

const progressBuffer = regl.buffer(progress);
const endpointProgressBuffer = regl.buffer([progress.slice(0, 3), progress.slice(-3).reverse()]);

const lineData = {
  vertexCount: points.length,
  vertexAttributes: {
    point: regl.buffer(points),
    width: regl.buffer(widths),
    progress: progressBuffer,
    pointIndex: regl.buffer(index),
  },
  endpointCount: 2,
  endpointAttributes: {
    point: regl.buffer([points.slice(0, 3), points.slice(-3).reverse()]),
    width: regl.buffer([widths.slice(0, 3), widths.slice(-3).reverse()]),
    progress: endpointProgressBuffer,
    pointIndex: regl.buffer([index.slice(0, 3), index.slice(-3).reverse()]),
  },
};

const drawLines = reglLines(regl, {
  debug,
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 point;
    #pragma lines: attribute float width;
    #pragma lines: attribute float progress;
    #pragma lines: attribute float pointIndex;
    #pragma lines: position = project(point);
    #pragma lines: width = getWidth(width);
    #pragma lines: varying float progress = getProgress(progress);
    #pragma lines: varying float pointIndex = getPointIndex(pointIndex);

    uniform float stretch, flip, lineWidth;

    float getProgress(float p) { return p; }
    float getPointIndex(float p) { return p; }

    vec4 project (vec2 p) {
      return vec4(p * vec2(pow(stretch, 4.0), flip), 0, 1) - vec4(0.2,0,0,0);
    }

    float getWidth (float width) {
      return lineWidth;
    }`,
  frag: `
    #extension GL_OES_standard_derivatives : enable
    precision mediump float;

    uniform bool squareCap;
    uniform float pixelRatio, dashLength;
    uniform vec4 borderColor, lineColor;

    varying float useC;
    varying vec2 lineCoord;
    varying float progress, pointIndex;
    ${debug ? `
    varying float instanceID;
    varying vec2 triStripGridCoord;
    ` : ''}

    // Unit grid lines
    float grid (vec3 parameter, float width, float feather) {
      float w1 = width - feather * 0.5;
      vec3 d = fwidth(parameter);
      vec3 looped = 0.5 - abs(mod(parameter, 1.0) - 0.5);
      vec3 a3 = smoothstep(d * (w1 + feather), d * w1, looped);
      return max(max(a3.x, a3.y), a3.z);
    }

    void main () {
      float sdf = squareCap ? max(abs(lineCoord.x), abs(lineCoord.y)) : length(lineCoord);

      gl_FragColor.a = lineColor.a;

      ${debug ? `
      if (instanceID < 0.0) {
        // End caps are red
        gl_FragColor.rgb = vec3(0.8, 0.1, 0.4);
      } else {
        // Remaining segments alternate blues
        gl_FragColor.rgb = mod(instanceID, 2.0) == 0.0 ? vec3(0.4, 0.7, 1.0) : vec3(0.2, 0.3, 0.7);
      }
      ` : ''}
      //gl_FragColor.rg = 0.5 * lineCoord.xy + 0.5;

      //gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1), fract(pointIndex * 4.0) > 0.5 ? 1.0 : 0.0);
      float dash = fract(progress / (pixelRatio * dashLength)) > 0.5 ? 0.0 : 1.0;
      if (dash == 0.0) gl_FragColor.a *= 0.2;
      //gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1), dash);

      // Add a border
      bool showBorder = sdf > 0.75 && length(lineColor.rgb - borderColor.rgb) > 0.1;
      if (showBorder) gl_FragColor = mix(gl_FragColor, borderColor, 0.75);

      // Draw unit grid lines and a diagonal line using the vertex ID turned into a vec2 varying.
      //
      //   0     2     4     6     8
      //   + --- + --- + --- + --- +
      //   |   / |   / |   / |   / |
      //   | /   | /   | /   | /   |
      //   + --- + --- + --- + --- +
      //   1     3     5     7     9
      //
      float wire = grid(vec3(triStripGridCoord, triStripGridCoord.x + triStripGridCoord.y), 0.5 * pixelRatio, 1.0);
      //wire = mix(wire, grid(vec3(lineCoord.y * 6.0), 0.5 * pixelRatio, 1.0), 0.6);
      gl_FragColor = mix(gl_FragColor, vec4(1), wire * 0.5);
    }`,
  uniforms: {
    dashLength: ctx => ctx.pixelRatio * state.lineWidth * state.dashLength
  }
});

const applyCustomConfig = regl({
  uniforms: {
    lineColor: regl.prop('lineColor'),
    borderColor: regl.prop('borderColor'),
    borderWidth: (ctx, props) => [
      (props.lineWidth - props.borderWidth * 2 - 0.5) / props.lineWidth,
      (props.lineWidth - props.borderWidth * 2 + 0.5) / props.lineWidth
    ],
    squareCap: (ctx, props) => props.cap === 'square',
    stretch: regl.prop('stretch'),
    flip: regl.prop('flip'),
    pixelRatio: regl.context('pixelRatio'),
    lineWidth: (ctx, props) => ctx.pixelRatio * props.lineWidth,
    debug: regl.prop('debug'),
  },
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one minus src alpha',
      dstAlpha: 1
    }
  },
  cull: {
    enable: (ctx, props) => !!props.cull,
    face: 'back'
  },
  depth: {
    enable: (ctx, props) => !!props.depth
  }
})

function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1], depth: 1});

  applyCustomConfig({
    lineColor: [0, 0, 0, state.opacity],
    borderColor: [0.5, 0.5, 0.5, 1],
    ...state
  }, () => {
    drawLines({...lineData, ...state});
  });
}

draw();
