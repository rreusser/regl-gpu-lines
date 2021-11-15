// rollup.config.js
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';

export default [
  {
    input: 'src/index.js',
    output: 'dist/regl-gpu-lines.js',
    format: 'umd',
    name: 'reglLines',
    babelPresets: [],
  }, {
    input: 'src/index.js',
    output: 'dist/regl-gpu-lines.compat.js',
    format: 'umd',
    name: 'reglLines',
    babelPresets: ['@babel/preset-env'],
  },
].map(bundle => ({
  input: bundle.input,
  output: {
    file: bundle.output,
    format: bundle.format,
    name: bundle.name,
  },
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      presets: bundle.babelPresets
    }),
    json()
  ]
}));
