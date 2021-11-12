const regl = createREGL({
  extensions: [
    'ANGLE_instanced_arrays',
    'OES_standard_derivatives',
  ],
});

const n = 21;
const x = [...Array(n).keys()].map(t => (t / (n - 1) * 2 - 1) * 0.8);
const xy = x.map(x => [x, 0.5 * Math.cos(x * 8)])

const lineData = window.linedata = {
  join: 'miter',
  joinResolution: 4,
  cap: 'round',
  capResolution: 8,
  vertexCount: xy.length,
  vertexAttributes: {
    point: regl.buffer(xy),
  },
  endpointCount: 2,
  endpointAttributes: {
    point: regl.buffer([xy.slice(0, 3), xy.slice(-3).reverse()]),
  }
};

const drawLines = reglLines(regl, {
  debug: true,
  vert: `
    precision highp float;
    uniform mediump float pixelRatio;

    #pragma lines: attribute vec2 point;
    #pragma lines: position = project(point);
    #pragma lines: width = getWidth();

    vec4 project (vec2 p) { return vec4(p, 0, 1); }
    float getWidth () { return 50.0 * pixelRatio; }`,
  frag: `
    #extension GL_OES_standard_derivatives : enable
    precision mediump float;
    uniform float pixelRatio;
    varying float instanceID;
    varying vec2 triStripCoord;

    // Unit grid lines
    float grid (vec3 parameter, float width, float feather) {
      float w1 = width - feather * 0.5;
      vec3 d = fwidth(parameter);
      vec3 looped = 0.5 - abs(mod(parameter, 1.0) - 0.5);
      vec3 a3 = smoothstep(d * w1, d * (w1 + feather), looped);
      return min(min(a3.x, a3.y), a3.z);
    }

    void main () {
      float iInstanceID = floor(instanceID + 0.5);
      if (iInstanceID < 0.0) {
        // End caps are red
        gl_FragColor.rgb = vec3(0.8, 0.1, 0.4);
      } else {
        // Remaining segments alternate blues
        gl_FragColor.rgb = mod(iInstanceID, 2.0) == 0.0 ? vec3(0.4, 0.7, 1.0) : vec3(0.2, 0.3, 0.7);
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
      float wire = grid(vec3(triStripCoord, triStripCoord.x + triStripCoord.y), 0.5 * pixelRatio, 1.0);
      gl_FragColor.rgb = mix(vec3(1), gl_FragColor.rgb, wire);

      gl_FragColor.a = 0.6;
    }`,
  uniforms: {
    pixelRatio: regl.context('pixelRatio'),
    lineWidth: (ctx, props) => ctx.pixelRatio * props.lineWidth,
    debug: regl.prop('debug'),
  },
  // Draw with depth disabled and some alpha so we can see overlap
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one minus src alpha',
      dstAlpha: 1
    }
  },
  depth: {
    enable: false
  }
});


function draw () {
  regl.poll();
  regl.clear({color: [0.2, 0.2, 0.2, 1]});
  drawLines(lineData);
}

draw();
window.addEventListener('resize', draw);
