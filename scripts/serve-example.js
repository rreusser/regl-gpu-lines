const budo = require('budo');
const path = require('path');
const defaultIndex = require('simple-html-index');
const hyperstream = require('hyperstream');
const toStream = require('string-to-stream');

const entry = 'examples/' + process.argv[2] + '.js';

if (!entry) {
  console.error('Usage: npm start <path/to/example.js>');
  process.exit(1);
}

const preface = `
  window.wrapGUI = require('controls-gui');
  window.State = require('controls-state');
  window.createREGL = require('regl');
  window.glMatrix = require('gl-matrix');
  window.reglLines = require('./src/index.js');
`;

budo(path.join(__dirname, 'dummy.js'), {
  host: 'localhost',
  open: true,
  live: true,
  browserify: {
    plugin: [
      b => b.add(toStream(preface)),
      b => b.add(path.join(__dirname, '..', entry))
    ]
  },
}).on('connect', function (ev) {
  console.log('Server running on %s', ev.uri);
  console.log('LiveReload running on port %s', ev.livePort);
}).on('update', function (buffer) {
  console.log('bundle - %d bytes', buffer.length);
});

console.log('entry:', entry);
