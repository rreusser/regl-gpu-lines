// We currently use these from unpkg instead:
//const createREGL = require('regl');
//const reglLines = require('../');

const renderFixture = require('../test/util/render-fixture.js');

const h = (type, props, c) => {
  const el = document.createElement(type);
  if (c) (Array.isArray(c) ? c : [c]).forEach(c => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return Object.assign(el, props);
}

document.body.appendChild(h('style', {}, `
html { font-family: sans-serif; }
p { line-height: 1.4em; max-width: 640px; }
.actual { border: 1px solid #888 }
.expected { border: 1px solid #23f; }
.group { margin-bottom: 1em; }
summary { cursor: pointer; }
`));

const initialFixtureName = window.location.hash.replace(/^#/, '') || Object.keys(fixtures)[0];

const fixtureSelector = h('select', null, Object.keys(fixtures).map(value =>
  h('option', {value, selected: value === initialFixtureName ? 'selected' : ''}, value)
));
const expected = h('img', {className: 'expected'});
const canvas = h('canvas', {className: 'actual'});
const fixtureDataLabel = h('summary');
const fixtureDataPre = h('pre');

document.body.appendChild(h('div', {}, [
  h('h1', {}, 'regl-gpu-lines render tests'),
  h('a', {href: 'https://github.com/rreusser/regl-gpu-lines'}, '← Back to project page'),
  h('p', {}, [
    'This page uses ',
    h('a', {href: 'https://unpkg.com/regl-gpu-lines@latest'}, 'regl-gpu-lines@latest'),
    ' from ',
    h('a', {href: 'https://unpkg.com'}, 'unpkg.com'),
    ' to run tests live. The "actual" version shows a live-rendered image, while the "expected" version is pulled from GitHub. If reporting an issue, please click the unpkg link above and note the version of regl-gpu-lines used. If you need to check versions or investigate more closely, you may need to clone the repo and run these manually.'
  ]),
  h('div', {className: 'group'}, [fixtureSelector]),
  h('div', {className: 'group'}, [
    h('div', {}, 'Actual:'),
    canvas,
  ]),
  h('div', {className: 'group'}, [
    h('div', {}, 'Expected:'),
    expected,
  ]),
  h('details', {}, [fixtureDataLabel, h('code', {}, fixtureDataPre)])
]));

const regl = createREGL({
  canvas,
  pixelRatio: 1,
  attributes: {antialias: false},
  extensions: ['ANGLE_instanced_arrays'],
  optionalExtensions: ['OES_standard_derivatives']
});

fixtureSelector.addEventListener('input', function (event) {
  const fixtureName = event.target.value;
  window.location.hash = fixtureName;
  executeFixture(fixtures[fixtureName]);
});

function executeFixture (fixture) {
  const [width, height] = fixture.fixture.shape;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  renderFixture(regl, reglLines, fixture.fixture);

  fixtureDataLabel.textContent = `${fixture.name}/fixture.json`;
  fixtureDataPre.textContent = JSON.stringify(fixture.fixture, null, 2);

  expected.src = '';
  expected.src = `https://raw.githubusercontent.com/rreusser/regl-gpu-lines/main/test/fixtures/${fixture.name}/expected.png`;
}

executeFixture(fixtures[initialFixtureName]);
