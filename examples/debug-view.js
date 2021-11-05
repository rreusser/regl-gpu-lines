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
  join: 'round',
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
    varying vec2 barycentric;

    // Draw the edge of the triangle using barycentric coords
    float wireframe (vec2 vBC, float width, float feather) {
      float w1 = width - feather * 0.5;
      vec3 bary = vec3(vBC.x, vBC.y, 1.0 - vBC.x - vBC.y);
      vec3 d = fwidth(bary);
      vec3 a3 = smoothstep(d * w1, d * (w1 + feather), bary);
      return min(min(a3.x, a3.y), a3.z);
    }

    void main () {
      if (instanceID < 0.0) {
        // End caps are red
        gl_FragColor.rgb = vec3(0.8, 0.1, 0.4);
      } else {
        // Remaining segments alternate blues
        gl_FragColor.rgb = mod(instanceID, 2.0) == 0.0 ? vec3(0.4, 0.7, 1.0) : vec3(0.2, 0.3, 0.7);
      }

      // Draw a grid
      float wire = wireframe(barycentric, 0.5 * pixelRatio, 1.0);
      gl_FragColor.rgb = mix(vec3(1), gl_FragColor.rgb, wire);

      gl_FragColor.a = 0.5;
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
