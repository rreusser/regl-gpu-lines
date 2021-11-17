const fs = require('fs');
const path = require('path');
const glob = require('glob');
const htmlIndex = require('simple-html-index');
const hyperstream = require('hyperstream');
const browserify = require('browserify');
const toString = require('stream-to-string');

const allFixtures = {};
const fixtureDir = path.join(__dirname, '..', 'test', 'fixtures');
glob.sync(path.join(fixtureDir, '**', 'fixture.json'))
  .forEach(test => {
    const name = path.dirname(path.relative(fixtureDir, test));
    const testPath = path.join(fixtureDir, name, 'fixture.json');
    const fixture = JSON.parse(fs.readFileSync(testPath, 'utf8'));
    allFixtures[name] = {name, fixture};
  });

toString(
  browserify().add(path.join(__dirname, 'browser-fixture-renderer.js')).bundle(),
  function (err, bundle) {
    if (err) throw new Error(err);

    htmlIndex({title: 'regl-gpu-lines tests'})
      .pipe(hyperstream({
        head: {
          _appendHtml: `
          <script src="https://unpkg.com/regl@2.1.0/dist/regl.js"></script>
          <script src="https://unpkg.com/regl-gpu-lines@latest"></script>
          `
        },
        body: {
          _appendHtml: `
<script>const fixtures = ${JSON.stringify(allFixtures, null, 2)};</script>
<script>${bundle}</script>
`
        }
      }))
      .pipe(fs.createWriteStream(path.join(__dirname, '..', 'docs', 'tests.html')));
  }
);
