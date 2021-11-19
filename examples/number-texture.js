module.exports = createNumberCanvas;

function createNumberCanvas (size) {
  const canvas = document.createElement('canvas');
  const img = document.createElement('img');
  const ctx = canvas.getContext('2d');
  canvas.width = 10 * size;
  canvas.height = size;
  ctx.font = `${size}px monospace`;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size * 10, size);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 10; i++) {
    ctx.fillText(i, (i + 0.5) * size, size * 0.5);
  }

  const returnValue = new Promise(resolve => {
    img.onload = () => resolve(img);
  });
  img.src = canvas.toDataURL();
  return returnValue;
}
