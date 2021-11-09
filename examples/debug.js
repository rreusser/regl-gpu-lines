const pixelRatio = window.devicePixelRatio;
const regl = createREGL({
  pixelRatio,
  extensions: [
    'ANGLE_instanced_arrays',
    'OES_standard_derivatives',
  ],
  attributes: {
    antialias: true
  }
});
regl._gl.canvas.style.position = 'fixed';

const state = wrapGUI(State({
  lineConfig: State.Section({
    capResolution: State.Slider(4, {min: 1, max: 30, step: 1}),
    joinResolution: State.Slider(3, {min: 1, max: 30, step: 1}),
    cap: State.Select('round', {options: ['round', 'square', 'none']}),
    join: State.Select('round', {options: ['round', 'miter', 'bevel']}),
    miterLimit: State.Slider(8, {min: 1, max: 8, step: 0.01}),
  }, {label: 'line config', expanded: false}),
  geometry: State.Section({
    stretch: State.Slider(0.97, {min: 0.01, max: 2, step: 0.001}),
    flip: State.Slider(1, {min: -1, max: 1, step: 0.001}),
  }, {expanded: true}),
  line: State.Section({
    width: State.Slider(50, {min: 1, max: 100, step: 0.1}),
    opacity: State.Slider(0.8, {min: 0, max: 1, step: 0.01}),
  }, {label: 'line properties', expanded: false}),
  border: State.Section({
    width: State.Slider(5, {min: 0, max: 10, step: 0.1}),
    opacity: State.Slider(0.7, {min: 0, max: 1, step: 0.01}),
  }, {expanded: false}),
  dash: State.Section({
    length: State.Slider(1, {min: 0, max: 8, step: 0.1}),
    opacity: State.Slider(0.3, {min: 0, max: 1, step: 0.01}),
  }, {expanded: false, label: 'line dash'}),
  rendering: State.Section({
    wireframeOpacity: State.Slider(0.7, {min: 0, max: 1, step: 0.01}),
    cull: State.Select('none', {options: ['none', 'front', 'back']}),
    depth: true,
    colorInstances: true,
  }, {
    expanded: false
  })
}), {
  containerCSS: `
    position: absolute;
    right: 0;
  `
});
state.$onChange(draw);

function project(p) {
  return [
    (0.5 + 0.5 * (p[0] * Math.pow(state.geometry.stretch, 4.0) - 0.2)) * window.innerWidth,
    (0.5 + 0.5 * (p[1] * state.geometry.flip)) * window.innerHeight,
  ];
}

const path = [
  [-0.75, -0.5],
  [-0.5, -0.5],
  [-0.4, 0.5],
  [-0.35, 0.0],
  [-0.1, 0.5],
  [0.0, 0.0],
  [0.01, 0.0],
  //[0.02, 0.0],
  //[0.03, 0.0],
  //[0.04, 0.0],
  //[0.05, 0.0],
  //[0.06, 0.0],
  //[0.07, 0.0],
  //[0.07, 0.5],
  //[0.07, 0.0],
  [0.25, 0.0],
  [0.5, -0.5],
  [0.75, -0.25],
  [1, -0.25]
];
const dist = Array(path.length).fill(0);

function computeCumulativeDistance (dist, path, project) {
  let prevPoint = project(path[0]);
  for (let i = 1; i < path.length; i++) {
    const point = project(path[i]);
    const d =  dist[i - 1] + Math.hypot(point[0] - prevPoint[0], point[1] - prevPoint[1]);
    dist[i] = d;
    prevPoint = point;
  }
  return dist;
}

const lineData = {
  vertexCount: path.length,
  vertexAttributes: {
    point: regl.buffer(path),
    dist: regl.buffer(dist),
  },
  endpointCount: 2,
  endpointAttributes: {
    point: regl.buffer([path.slice(0, 3), path.slice(-3).reverse()]),
    dist: regl.buffer([dist.slice(0, 3), dist.slice(-3).reverse()]),
  },
};

const drawLines = reglLines(regl, {
  debug: true,
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 point;
    #pragma lines: attribute float dist;
    #pragma lines: position = project(point);
    #pragma lines: width = getWidth();
    #pragma lines: varying float dist = getProgress(dist);

    uniform float stretch, flip, lineWidth, borderWidth;

    float getProgress(float p) { return p; }
    float getPointIndex(float p) { return p; }

    vec4 project (vec2 p) {
      return vec4(p * vec2(pow(stretch, 4.0), flip), 0, 1) - vec4(0.2,0,0,0);
    }

    float getWidth () {
      return lineWidth;
    }`,
  frag: `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform bool squareCap, useBorder, colorInstances;
    uniform float pixelRatio, dashLength, lineWidth, borderWidth, wireframeOpacity;
    uniform vec4 borderColor, lineColor, dashColor;

    varying vec2 lineCoord;
    varying float dist;
    varying float instanceID;
    varying vec2 triStripGridCoord;

    float grid (vec3 parameter, float width, float feather) {
      float w1 = width - feather * 0.5;
      vec3 d = fwidth(parameter);
      vec3 looped = 0.5 - abs(mod(parameter, 1.0) - 0.5);
      vec3 a3 = smoothstep(d * (w1 + feather), d * w1, looped);
      return max(max(a3.x, a3.y), a3.z);
    }

    float linearstep (float a, float b, float x) {
      return clamp((x - a) / (b - a), 0.0, 1.0);
    }

    void main () {
      float sdf = lineWidth * 0.5 * (
        squareCap ? max(abs(lineCoord.x), abs(lineCoord.y)) : length(lineCoord)
      );

      gl_FragColor.a = lineColor.a;

      gl_FragColor.rgb = vec3(0.4, 0.7, 1.0);
      if (colorInstances) {
        if (instanceID < 0.0) {
          gl_FragColor.rgb = vec3(0.8, 0.1, 0.4);
        } else if (mod(instanceID, 2.0) == 1.0) {
          gl_FragColor.rgb = vec3(0.2, 0.3, 0.7);
        }
      }

      if (dashColor.a > 0.0 && dashLength > 0.0) {
        float dashvar = fract(dist / dashLength) * dashLength;
        float dash = linearstep(0.0, 1.0, dashvar)
          * linearstep(dashLength * 0.5 + 1.0 / pixelRatio, dashLength * 0.5, dashvar);
        gl_FragColor.a *= mix(1.0, 1.0 - dashColor.a, dash);
      }

      if (useBorder && borderColor.a > 0.0) {
        float border = linearstep(
          lineWidth * 0.5 - borderWidth - 0.5,
          lineWidth * 0.5 - borderWidth + 0.5,
          sdf
        );

        gl_FragColor.rgb = mix(gl_FragColor.rgb, borderColor.rgb, border * borderColor.a);
      }

      // Draw unit grid lines and a diagonal line using the vertex ID turned into a vec2 varying.
      //
      //   0     2     4     6     8
      //   + --- + --- + --- + --- +
      //   |   / |   / |   / |   / |
      //   | /   | /   | /   | /   |
      //   + --- + --- + --- + --- +
      //   1     3     5     7     9
      //
      if (wireframeOpacity > 0.0) {
        float wire = grid(vec3(triStripGridCoord, triStripGridCoord.x + triStripGridCoord.y), 0.5 * pixelRatio, 2.0 / pixelRatio);
        gl_FragColor = mix(gl_FragColor, vec4(1), wire * wireframeOpacity);
      }
    }`,
  uniforms: {
    colorInstances: regl.prop('rendering.colorInstances'),
    wireframeOpacity: regl.prop('rendering.wireframeOpacity'),
    useBorder: (ctx, props) => props.border.width > 0,
    lineColor: regl.prop('lineColor'),
    borderColor: regl.prop('borderColor'),
    dashColor: regl.prop('dashColor'),
    squareCap: (ctx, props) => props.cap === 'square',
    stretch: regl.prop('geometry.stretch'),
    flip: regl.prop('geometry.flip'),
    pixelRatio: regl.context('pixelRatio'),
    lineWidth: (ctx, props) => ctx.pixelRatio * props.line.width,
    borderWidth: (ctx, props) => ctx.pixelRatio * props.border.width,
    dashLength: (ctx, props) => props.line.width * props.dash.length * 2.0,
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
    enable: (ctx, props) => props.rendering.cull !== 'none',
    face: (ctx, props) => props.rendering.cull === 'none' ? 'front' : props.rendering.cull
  },
  depth: {
    enable: (ctx, props) => !!props.rendering.depth
  }
});

function updateBuffers () {
  //lineData.vertexAttributes.xy.subdata(path);
  //lineData.endpointAttributes.xy.subdata([path.slice(0, 3), path.slice(-3).reverse()]);
  lineData.vertexAttributes.dist.subdata(dist);
  lineData.endpointAttributes.dist.subdata([dist.slice(0, 3), dist.slice(-3).reverse()]);
}

function draw () {
  computeCumulativeDistance(dist, path, project);
  updateBuffers();

  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1], depth: 1});

  drawLines({
    ...lineData,
    ...state.lineConfig,
    ...state,
    lineColor: [0, 0, 0, state.line.opacity],
    borderColor: [0, 0, 0, state.border.opacity],
    dashColor: [0, 0, 0, state.dash.opacity],
  });
}

computeCumulativeDistance(dist, path, project);
draw();

window.addEventListener('resize', draw);
