const budo = require('budo');
const path = require('path');
const defaultIndex = require('simple-html-index');
const hyperstream = require('hyperstream');
const toStream = require('string-to-stream');
const getFixtures = require('./get-fixtures.js');

const preface = `
  window.fixtures = ${JSON.stringify(getFixtures())};
  window.createREGL = require('regl');
  window.reglLines = require('./src/index.js');
  window.env = 'development';
`;

budo(path.join(__dirname, 'dummy.js'), {
  //host: 'localhost',
  open: true,
  live: true,
  watchGlob: [
    path.join(__dirname, '..', 'test', '**', 'fixture.json'),
    path.join(__dirname, '..', '**', '*.js'),
  ],
  browserify: {
    plugin: [
      b => b.add(toStream(preface)),
      b => b.add(path.join(__dirname, 'browser-fixture-renderer.js'))
    ]
  },
  forceDefaultIndex: true,
  defaultIndex: function () {
    return defaultIndex({
      entry: 'dummy.js'
    }).pipe(hyperstream({
      head: {
        _appendHtml: '<meta name="viewport" content="width=device-width, initial-scale=1">'
      }
    }));
  },
  middleware: [
    function (req, res, next) {
      // Read every time rather than static file serving to ensure it's not cached
      if (/^\/test\/fixtures\/.*\/fixture\.json$/.test(req.url)) {
        fs.createReadStream(path.join('..', req.url)).pipe(res);
      } else {
        next()
      }
    }
  ]
}).on('connect', function (ev) {
  console.log('Server running on %s', ev.uri);
  console.log('LiveReload running on port %s', ev.livePort);
}).on('update', function (buffer) {
  console.log('bundle - %d bytes', buffer.length);
});
