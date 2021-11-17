module.exports = renderFixture;

function replaceNullWithNaN (data) {
  for (let i = 0; i < data.length; i++) {
    if (Array.isArray(data[i])) {
      replaceNullWithNaN(data[i]);
    } else if (data[i] === null) {
      data[i] = NaN;
    }
  }
  return data;
}

function renderFixture(regl, createDrawLines, fixture) {
  const drawLines = createDrawLines(regl, {
    ...fixture.command,
    vert: fixture.command.vert.join('\n'),
    frag: fixture.command.frag.join('\n')
  });
  regl.poll();
  regl.clear({color: [1, 1, 1, 1], depth: 1});

  const lineData = fixture.data ? {...fixture.data} : {};
  lineData.vertexAttributes = {};
  lineData.endpointAttributes = {};


  if (fixture.vertexAttributes) {
    lineData.vertexAttributes = {};
    for (const [name, attribute] of Object.entries(fixture.vertexAttributes)) {
      const sanitizedAttr = replaceNullWithNaN(attribute);

      lineData.vertexAttributes[name] = regl.buffer(sanitizedAttr);
      lineData.vertexCount = sanitizedAttr.length;
    }
  }

  if (fixture.endpointAttributes) {
    lineData.endpointAttributes = {};
    for (const [name, attribute] of Object.entries(fixture.endpointAttributes)) {
      const sanitizedAttr = replaceNullWithNaN(attribute);

      // If endpoint data is provided, use it
      lineData.endpointAttributes[name] = regl.buffer(sanitizedAttr);
      lineData.endpointCount = sanitizedAttr.length;
    }
  }

  drawLines(lineData);
}
