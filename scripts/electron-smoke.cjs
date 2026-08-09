const path = require('node:path');
const {app, BrowserWindow} = require('electron');

const timeout = setTimeout(() => {
  process.stderr.write('ELECTRON_SMOKE_TIMEOUT\n');
  app.exit(2);
}, 15000);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  await window.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  const result = await window.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('#card');
    const text = document.querySelector('#text');
    const bounds = card.getBoundingClientRect();
    return {card: Boolean(card), text: text.textContent, width: Math.ceil(bounds.width), height: Math.ceil(bounds.height)};
  })()`);
  if (!result.card || !result.text || result.width < 140 || result.height < 32) {
    throw new Error(`Invalid overlay render: ${JSON.stringify(result)}`);
  }
  process.stdout.write(`ELECTRON_SMOKE_OK ${result.width}x${result.height}\n`);
  clearTimeout(timeout);
  window.destroy();
  app.exit(0);
}).catch(error => {
  process.stderr.write(`ELECTRON_SMOKE_FAIL ${error.name}: ${error.message}\n`);
  clearTimeout(timeout);
  app.exit(1);
});
