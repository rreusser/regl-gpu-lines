const regl = createREGL({
  pixelRatio: 2,
  extensions: [
    'ANGLE_instanced_arrays',
    'OES_standard_derivatives',
  ],
});

const debug = true;

const state = wrapGUI(State({
    capResolution: State.Slider(21, {min: 1, max: 30, step: 1}),
    joinResolution: State.Slider(2, {min: 1, max: 30, step: 1}),
    cap: State.Select('square', {options: ['round', 'square', 'none']}),
    join: State.Select('round', {options: ['round', 'miter', 'bevel']}),
    lineWidth: State.Slider(80, {min: 1, max: 100, step: 0.1}),
    //borderWidth: State.Slider(10, {min: 0, max: 5, step: 0.1}),
    opacity: State.Slider(0.3, {min: 0, max: 1, step: 0.01}),
    stretch: State.Slider(0.9, {min: 0.01, max: 2, step: 0.01}),
    flip: State.Slider(1, {min: -1, max: 1, step: 0.01}),
    miterLimit: State.Slider(8, {min: 1, max: 8, step: 0.01}),
    //n: State.Slider(11, {min: 3, max: 101, step: 1}),
    depth: false,
    cull: false,
  })
);
state.$onChange(() => draw())
window.addEventListener('resize', () => draw());

const points = [[-0.75, 0.75], [-0.5, 0.5], [-0.25, 0.75], [0.0, -0.7], [0.25, 0.75], [0.5, 0.7], [0.75, 0.0]];
const widths = [1, 2, 1, 2, 1, 2, 1];
const lineData = window.linedata = {
  vertexCount: points.length,
  vertexAttributes: {
    point: regl.buffer(points),
    width: regl.buffer(widths),
  },
  endpointCount: 2,
  endpointAttributes: {
    point: regl.buffer([points.slice(0, 3), points.slice(-3).reverse()]),
    width: regl.buffer([widths.slice(0, 3), widths.slice(-3).reverse()]),
  }
};

const drawLines = reglLines(regl, {
  debug,
  vert: `
    precision highp float;

    #pragma lines: attribute vec2 point;
    #pragma lines: attribute float width;
    #pragma lines: position = project(point);
    #pragma lines: width = getWidth(width);

    uniform float stretch, flip, lineWidth;

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
    uniform float pixelRatio;
    uniform vec4 borderColor, lineColor;

    varying vec2 lineCoord;
    ${debug ? `
    varying float instanceID;
    varying vec2 barycentric;
    ` : ''}

    float gridFactor (vec2 vBC, float width, float feather) {
      float w1 = width - feather * 0.5;
      vec3 bary = vec3(vBC.x, vBC.y, 1.0 - vBC.x - vBC.y);
      vec3 d = fwidth(bary);
      vec3 a3 = smoothstep(d * w1, d * (w1 + feather), bary);
      return min(min(a3.x, a3.y), a3.z);
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

      // Invert the border
      //bool showBorder = sdf > 0.75 && length(lineColor.rgb - borderColor.rgb) > 0.1;
      //if (showBorder) gl_FragColor.rgb = mix(gl_FragColor.rgb, borderColor.rgb, 0.75);

      // Draw a grid
      ${debug ? `
      gl_FragColor.rgb = mix(vec3(1), gl_FragColor.rgb, gridFactor(barycentric, 0.5 * pixelRatio, 1.0));
      ` : ''}
    }`
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
  regl.clear({color: [0.2, 0.2, 0.2, 1]});

  applyCustomConfig({
    lineColor: [0, 0, 0, state.opacity],
    borderColor: [1, 1, 1, state.opacity],
    ...state
  }, () => {
    drawLines({...lineData, ...state});
  });
}

draw();
