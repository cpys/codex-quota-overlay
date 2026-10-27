const path = require('node:path');
const {app, BrowserWindow, ipcMain} = require('electron');

app.disableHardwareAcceleration();

const timeout = setTimeout(() => {
  process.stderr.write('ELECTRON_SMOKE_TIMEOUT\n');
  app.exit(2);
}, 15000);

app
  .whenReady()
  .then(async () => {
    const overlay = new BrowserWindow({
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'src', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await overlay.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    const overlayResult = await overlay.webContents.executeJavaScript(`(() => {
      const card = document.querySelector('#card');
      const text = document.querySelector('#text');
      const bounds = card.getBoundingClientRect();
      return {card: Boolean(card), text: text.textContent, width: Math.ceil(bounds.width), height: Math.ceil(bounds.height)};
    })()`);
    if (
      !overlayResult.card ||
      !overlayResult.text ||
      overlayResult.width < 140 ||
      overlayResult.height < 32
    ) {
      throw new Error(`Invalid overlay render: ${JSON.stringify(overlayResult)}`);
    }

    for (const theme of ['light', 'dark']) {
      overlay.webContents.send('overlay:state', {
        text: '54% · 2h',
        accent: '#4dd18d',
        remaining: 54,
        mode: 'compact',
        status: 'ready',
        theme
      });
      const result = await overlay.webContents.executeJavaScript(`(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
        const card = document.querySelector('#card');
        return {
          theme: document.documentElement.dataset.theme,
          color: getComputedStyle(card).color,
          mode: card.dataset.mode,
          text: document.querySelector('#text').textContent
        };
      })()`);
      const expectedColor = theme === 'light' ? 'rgb(32, 36, 44)' : 'rgb(245, 246, 248)';
      if (
        result.theme !== theme ||
        result.color !== expectedColor ||
        result.mode !== 'compact' ||
        result.text !== '54% · 2h'
      ) {
        throw new Error(`Invalid overlay theme: ${JSON.stringify(result)}`);
      }
    }

    const {createPreviewState} = await import('./ui-preview-state.mjs');
    let state = createPreviewState();
    const channels = [
      'dashboard:get-state',
      'dashboard:update-settings',
      'dashboard:clear-history',
      'dashboard:refresh',
      'dashboard:copy-diagnostics'
    ];
    ipcMain.handle('dashboard:get-state', () => state);
    ipcMain.handle('dashboard:update-settings', (_event, patch) => {
      state.preferences = {
        ...state.preferences,
        ...patch,
        history: {...state.preferences.history, ...(patch.history || {})},
        alerts: {...state.preferences.alerts, ...(patch.alerts || {})}
      };
      return state;
    });
    ipcMain.handle('dashboard:clear-history', () => {
      state.history = {...state.history, points: [], sampleCount: 0};
      return state;
    });
    ipcMain.handle('dashboard:refresh', () => state);
    ipcMain.handle('dashboard:copy-diagnostics', () => true);

    const dashboard = new BrowserWindow({
      show: false,
      width: 960,
      height: 760,
      webPreferences: {
        preload: path.join(__dirname, '..', 'src', 'dashboard-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await dashboard.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'dashboard.html'));
    const dashboardResult = await dashboard.webContents.executeJavaScript(`(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      const button = document.querySelector('[data-mode="insight"]');
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
      const theme = document.querySelector('#overlay-theme');
      theme.value = 'light';
      theme.dispatchEvent(new Event('change'));
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        title: document.title,
        remaining: document.querySelector('#remaining-value')?.textContent,
        windows: document.querySelectorAll('.window-card').length,
        chart: document.querySelectorAll('.chart-line').length,
        insightSelected: button.getAttribute('aria-pressed'),
        theme: (await window.quotaCenter.getState()).preferences.overlayTheme
      };
    })()`);
    if (
      dashboardResult.title !== 'Codex Quota Center' ||
      dashboardResult.remaining !== '54%' ||
      dashboardResult.windows < 2 ||
      dashboardResult.chart !== 1 ||
      dashboardResult.insightSelected !== 'true' ||
      dashboardResult.theme !== 'light'
    ) {
      throw new Error(`Invalid dashboard render: ${JSON.stringify(dashboardResult)}`);
    }

    process.stdout.write(
      `ELECTRON_SMOKE_OK overlay=${overlayResult.width}x${overlayResult.height} dashboard=${dashboardResult.remaining}/${dashboardResult.windows}\n`
    );
    clearTimeout(timeout);
    for (const channel of channels) ipcMain.removeHandler(channel);
    dashboard.destroy();
    overlay.destroy();
    app.exit(0);
  })
  .catch((error) => {
    process.stderr.write(`ELECTRON_SMOKE_FAIL ${error.name}: ${error.message}\n`);
    clearTimeout(timeout);
    app.exit(1);
  });
