# regl-gpu-lines

> Pure GPU screen-projected lines for [regl](https://github.com/regl-project/regl)

[API documentation &rarr;](./API.md)

This module implements a very general command for drawing lines using the [regl](https://github.com/regl-project/regl) WebGL library.

Apart from drawing nice lines, architecturally it has two goals:
- **Data may live on the GPU.** Since the CPU is not required to touch the data, you can draw thousands of separate lines very efficiently with just two WebGL draw calls.
- **Minimize unnecessary constraints.** The module facilitates setup but is agnostic toward projection, colors, blending, etc. Attributes and varyings are up to you. Think of it as a data flow framework for line rendering with which you can build the line rendering you require.

<p align="center">
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/debug.html">Live demo &rarr;</a></div>
  <div><a href="https://rreusser.github.io/regl-gpu-lines/docs/debug.html">
    <img src="./docs/debug.png" alt="Lines with round joins and caps" width="600">
  </a></div>
</p>

Features:

- Configure your own attributes, varyings, uniforms, and shaders
- Round joins, miters, and bevels
- Square and rounded end caps
- Use `NaN` to separate disjoint lines (see: [docs/multiple.html](https://rreusser.github.io/regl-gpu-lines/docs/multiple.html))
- Pass additional regl configuration to the constructor

Limitations:

- Lines with two vertices are rendered as overlapping end caps
- Width is best varied slowly as line joins to not take into account varying width
- Using the `lineCoord` varying to construct a SDF border requires `round` joins to produce consistent-width borders
- Line dashes are possible by passing a varying attribute, but will be skewed due to the geometry and resulting varying interpolation

## Examples

<p align="center">
  <a href="https://observablehq.com/d/ab6cd8bb0137889c"><img src="./docs/lorenz.gif" alt="GPGPU Lorenz Attractor"></a>
</p>

- [Basic example](https://rreusser.github.io/regl-gpu-lines/docs/basic.html): A minimal example
- [Variable width](https://rreusser.github.io/regl-gpu-lines/docs/variable-width.html): A basic line with variable width and color
- [Multiple lines](https://rreusser.github.io/regl-gpu-lines/docs/multiple.html): Use NaN to break up lines into multiple segments
- [Depth](https://rreusser.github.io/regl-gpu-lines/docs/depth.html): Layer lines using the z-coordinate
- [Closed loop](https://rreusser.github.io/regl-gpu-lines/docs/closed-loop.html): Repeat the first three vertices at the end to create a closed loop
- [Line border](https://rreusser.github.io/regl-gpu-lines/docs/border.html): Use `lineCoord` to draw a SDF line border
- [Debug](https://rreusser.github.io/regl-gpu-lines/docs/debug.html): Visually debug line geometry
- [GPGPU Strange Attractors](https://observablehq.com/d/ab6cd8bb0137889c): Feed a GPU particle simulation from texture data directly into line rendering

## Install

The `dist/` directory contains UMD bundles. There are two other options. You may install from npm:

```bash
npm install regl-gpu-lines
```

Or you may use from a CDN in environments like Observable or Codepen:

```
https://unpkg.com/regl-gpu-lines@latest
```

## API

See [API documentation](./API.md).

## See also

- [regl-line2d](https://github.com/gl-vis/regl-line2d): The line rendering library used by Plotly.js. If you want production quality lines, you should go here.
- [regl-line](https://www.npmjs.com/package/regl-line): Another excellent library. A regl function to draw flat 2D and 3D lines.
- [screen-projected-lines](https://github.com/substack/screen-projected-lines): An excellent, concise module for screen-projected lines. Without joins or caps, such lines are much simpler.
- [Drawing Lines is Hard](https://mattdesl.svbtle.com/drawing-lines-is-hard): [Matt DesLaurier](https://twitter.com/mattdesl)'s classic post on the topic of drawing lines.
- [Instanced Line Rendering Part I](https://wwwtyro.net/2019/11/18/instanced-lines.html): [Rye Terrell](https://wwwtyro.net/) first blog post on the topic.
- [Instanced Line Rendering Part II: Alpha blending](https://wwwtyro.net/2021/10/01/instanced-lines-part-2.html): [Rye Terrell](https://wwwtyro.net/)'s blog post which inspired me to pare the draw calls down to two and publish this module.

## License

&copy; 2021 Ricky Reusser. MIT License
