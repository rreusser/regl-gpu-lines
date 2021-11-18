const renderFixture = require('../test/util/render-fixture.js');
const pixelmatch = require('pixelmatch');

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
.diff { border: 1px solid #f23; }
.group { margin-bottom: 1em; }
summary { cursor: pointer; }
`));

const initialFixtureName = window.location.hash.replace(/^#/, '') || Object.keys(fixtures)[0];

const fixtureSelector = h('select', null, Object.keys(fixtures).map(value =>
  h('option', {value, selected: value === initialFixtureName ? 'selected' : ''}, value)
));
const expected = h('img', {className: 'expected', crossOrigin: 'Anonymous'});
const diff = h('canvas', {className: 'diff'});
const canvas = h('canvas', {className: 'actual'});
const fixtureDataLabel = h('summary');
const fixtureDataPre = h('pre');
const badCount = h('span', null, '0');

const prodMaterial = window.env === 'development' ? [] : [
  h('h1', {}, 'regl-gpu-lines render tests'),
  h('a', {href: 'https://github.com/rreusser/regl-gpu-lines'}, '← Back to project page'),
  h('p', {}, [
    'This page uses ',
    h('a', {href: 'https://unpkg.com/regl-gpu-lines@latest'}, 'regl-gpu-lines@latest'),
    ' from ',
    h('a', {href: 'https://unpkg.com'}, 'unpkg.com'),
    ' to run tests live.'
  ]),
];

document.body.appendChild(h('div', {}, [
  h('div', null, prodMaterial),
  h('div', {className: 'group'}, [fixtureSelector]),
  h('div', {className: 'group'}, [h('div', {}, 'Actual:'), canvas]),
  h('div', {className: 'group'}, [h('div', {}, 'Expected:'), expected]),
  h('div', {className: 'group'}, [h('div', {}, ['Diff (', badCount, ' incorrect pixels):']), diff]),
  h('details', {}, [fixtureDataLabel, h('code', {}, fixtureDataPre)])
]));

const regl = createREGL({
  canvas,
  pixelRatio: 1,
  attributes: {antialias: false, preserveDrawingBuffer: true},
  extensions: ['ANGLE_instanced_arrays'],
  optionalExtensions: ['OES_standard_derivatives']
});

fixtureSelector.addEventListener('input', e => executeFixture(e.target.value));

function flipPixels (data, width) {
  let tmp = new Uint8Array(width * 4);
  const height = data.length / (width * 4);
  for (let i = 0; i < height / 2; i++) {
    const idx1 = 4 * i * width;
    const idx2 = 4 * (height - i - 1) * width;
    const row1 = data.subarray(idx1, idx1 + width * 4);
    const row2 = data.subarray(idx2, idx2 + width * 4);
    tmp.set(row1);
    row1.set(row2);
    row2.set(tmp);
  }
  return data;
}

const expCanvas = h('canvas');
function compareImages(fixture, width, height) {
  const actualPixels = flipPixels(regl.read(), width);

  expCanvas.width = width;
  expCanvas.height = height;
  const expCtx = expCanvas.getContext('2d');
  expCtx.drawImage(expected, 0, 0);
  const expectedPixels = expCtx.getImageData(0, 0, width, height).data;

  diff.width = width;
  diff.height = height;
  const diffCtx = diff.getContext('2d');
  const diffImgData = diffCtx.getImageData(0, 0, width, height);

  const match = pixelmatch(actualPixels, expectedPixels, diffImgData.data, width, height);
  diffCtx.putImageData(diffImgData, 0, 0);

  badCount.textContent = match;
}

function getFixture (name) {
  if (window.env === 'development') {
    console.info(`Fetching local fixture: ${name}`);
    return fetch(`/test/fixtures/${name}/fixture.json`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.text();
      });
  } else {
    console.info(`Using fixture: ${name}`);
    return Promise.resolve(fixtures[name].fixture);
  }
}

function executeFixture (name) {
  getFixture(name).then(fixtureText => {
    if (!fixtureText) throw new Error(`Invalid or missing test name "${name}"`);
    const fixture = JSON.parse(fixtureText);
    window.location.hash = name;

    const {width, height} = fixture;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    renderFixture(regl, reglLines, fixture);

    fixtureDataLabel.textContent = `${name}/fixture.json`;
    fixtureDataPre.textContent = fixtureText;

    expected.onload = null;
    expected.src = '';
    expected.onload = () => compareImages(fixture, width, height);
    if (window.env === 'development') {
      expected.src = `/test/fixtures/${name}/expected.png`;
    } else {
      expected.src = `https://raw.githubusercontent.com/rreusser/regl-gpu-lines/main/test/fixtures/${name}/expected.png`;
    }
  });
}

executeFixture(initialFixtureName);
