import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  shell,
  Tray
} from 'electron';
import {CodexRpcClient} from './core/codex-rpc.js';
import {QuotaAlertTracker} from './core/alerts.js';
import {findCodexExecutable} from './core/codex-path.js';
import {Diagnostics, diagnosticMessage} from './core/diagnostics.js';
import {QuotaHistoryStore} from './core/history.js';
import {calculateQuotaInsights} from './core/insights.js';
import {placeOverlay} from './core/placement.js';
import {quotaView} from './core/quota.js';
import {SettingsStore} from './core/settings.js';
import {classifyTarget} from './core/target-window.js';
import {TelemetryClient} from './core/telemetry.js';
import {setStartupEnabled, startupEnabled} from './platform/startup.js';
import {ActiveWindowProvider} from './platform/active-window.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const packageMetadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const VERSION = packageMetadata.version;
const POLL_INTERVAL_MS = 250;
const QUOTA_REFRESH_MS = 60_000;
const USAGE_REFRESH_MS = 15 * 60_000;

let overlayWindow;
let dashboardWindow;
let tray;
let settings;
let telemetry;
let diagnostics;
let history;
let alerts;
let activeWindowProvider;
let rpc;
let overlaySize = {width: 520, height: 43};
let currentTargetBounds;
let pollTimer;
let polling = false;
let lastQuotaReadAt = 0;
let lastUsageReadAt = 0;
let missingSince = 0;
let shuttingDown = false;
let locale = 'zh-CN';
let latestQuota;
let latestUsage;
let latestInsights;
let lastQuotaUpdatedAt = 0;
let connectionStatus = 'inactive';
let dashboardIpcRegistered = false;
let latestOverlayState;

configureUserDataPath();
const selfTestPath = process.argv
  .find((argument) => argument.startsWith('--self-test='))
  ?.slice('--self-test='.length);
const shutdownRequested = process.argv.includes('--shutdown');
const dashboardRequested = process.argv.includes('--dashboard');
const hasLock = Boolean(selfTestPath) || app.requestSingleInstanceLock();
if (!hasLock || shutdownRequested) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (commandLine.includes('--shutdown')) quitApplication();
    else if (commandLine.includes('--dashboard')) showDashboard();
  });
}

app.whenReady().then(async () => {
  if (!hasLock || shutdownRequested) return;
  app.setAppUserModelId('com.cpys.codexquotaoverlay');
  if (selfTestPath) {
    const writeSelfTest = (result) => fs.writeFileSync(selfTestPath, JSON.stringify(result));
    writeSelfTest({ok: false, stage: 'starting', version: VERSION});
    const timeout = setTimeout(() => {
      writeSelfTest({ok: false, stage: 'timeout', version: VERSION});
      app.exit(2);
    }, 10_000);
    try {
      locale = app.getLocale() || 'zh-CN';
      diagnostics = new Diagnostics(locale);
      settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
      const currentSettings = settings.get();
      history = new QuotaHistoryStore(path.join(app.getPath('userData'), 'quota-history.json'), {
        enabled: false,
        retentionDays: currentSettings.history.retentionDays
      });
      alerts = new QuotaAlertTracker();
      registerDashboardIpc();
      await createOverlayWindow();
      await createDashboardWindow({show: false});
      const overlayRender = await overlayWindow.webContents.executeJavaScript(`(() => {
        const card = document.querySelector('#card');
        const bounds = card?.getBoundingClientRect();
        return {text: card?.textContent?.trim(), width: Math.ceil(bounds?.width || 0), height: Math.ceil(bounds?.height || 0)};
      })()`);
      const dashboardRender = await dashboardWindow.webContents.executeJavaScript(`(async () => {
        const bridgeState = await window.quotaCenter?.getState?.();
        return {
          bridgeVersion: bridgeState?.version,
          title: document.title,
          remaining: document.querySelector('#remaining-value')?.textContent?.trim(),
          sections: document.querySelectorAll('main section').length,
          shell: Boolean(document.querySelector('.page-shell'))
        };
      })()`);
      const result = {
        dashboard: dashboardRender,
        ok: Boolean(
          overlayRender.text &&
          overlayRender.width >= 140 &&
          overlayRender.height >= 32 &&
          dashboardRender.title === 'Codex Quota Center' &&
          dashboardRender.bridgeVersion === VERSION &&
          dashboardRender.remaining &&
          dashboardRender.sections >= 3 &&
          dashboardRender.shell
        ),
        overlay: overlayRender,
        packaged: app.isPackaged,
        platform: process.platform,
        stage: 'complete',
        version: VERSION
      };
      writeSelfTest(result);
      clearTimeout(timeout);
      dashboardWindow.destroy();
      overlayWindow.destroy();
      app.exit(result.ok ? 0 : 1);
    } catch (error) {
      writeSelfTest({
        detail: error instanceof Error ? error.message.slice(0, 200) : undefined,
        ok: false,
        stage: error instanceof Error ? error.name : 'error',
        version: VERSION
      });
      clearTimeout(timeout);
      app.exit(1);
    }
    return;
  }
  if (process.platform === 'darwin') app.dock?.hide();
  locale = app.getLocale() || 'zh-CN';
  diagnostics = new Diagnostics(locale);
  activeWindowProvider = new ActiveWindowProvider({
    platform: process.platform,
    helperRoot: app.isPackaged
      ? path.join(process.resourcesPath, 'native')
      : path.join(packageRoot, 'build', 'native')
  });
  activeWindowProvider.start();
  settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  const currentSettings = settings.get();
  history = new QuotaHistoryStore(path.join(app.getPath('userData'), 'quota-history.json'), {
    enabled: currentSettings.history.enabled,
    retentionDays: currentSettings.history.retentionDays
  });
  alerts = new QuotaAlertTracker();
  registerDashboardIpc();
  telemetry = new TelemetryClient({
    endpoint: process.env.CQO_TELEMETRY_ENDPOINT || packageMetadata.cqo?.telemetryEndpoint || '',
    version: VERSION,
    platform: platformName(),
    locale,
    settings
  });
  await createOverlayWindow();
  createTray();
  if (dashboardRequested) await showDashboard();
  await tick();
  pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  pollTimer.unref?.();
  telemetry.sendIfDue(false);
});

app.on('window-all-closed', () => {
  if (shuttingDown) app.exit(0);
});
app.on('before-quit', () => {
  cleanup();
});

function configureUserDataPath() {
  const base =
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? process.env.LOCALAPPDATA
      : app.getPath('appData');
  app.setPath('userData', path.join(base, 'CodexQuotaOverlay'));
}

async function createOverlayWindow() {
  const rendererPath = path.join(__dirname, 'renderer', 'index.html');
  const rendererUrl = pathToFileURL(rendererPath).href;
  overlayWindow = new BrowserWindow({
    width: overlaySize.width,
    height: overlaySize.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    type: process.platform === 'darwin' ? 'panel' : 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  overlayWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'pop-up-menu');
  overlayWindow.setIgnoreMouseEvents(true, {forward: true});
  overlayWindow.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true});
  overlayWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  overlayWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== rendererUrl) event.preventDefault();
  });
  await overlayWindow.loadFile(rendererPath);
  ipcMain.on('overlay:measured', (event, measured) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (event.sender !== overlayWindow.webContents || event.senderFrame?.url !== rendererUrl) return;
    const width = clamp(Math.ceil(Number(measured?.width) || 0), 180, 1400);
    const height = clamp(Math.ceil(Number(measured?.height) || 0), 32, 100);
    if (width === overlaySize.width && height === overlaySize.height) return;
    overlaySize = {width, height};
    overlayWindow.setContentSize(width, height, false);
    if (currentTargetBounds) positionOverlay(currentTargetBounds);
  });
  sendOverlayState({text: isChinese() ? '正在读取额度…' : 'Reading quota…', accent: '#70b2ff'});
}

function createTray() {
  const iconName = process.platform === 'darwin' ? 'tray-template.png' : 'icon.png';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, iconName)
    : path.join(packageRoot, 'build', 'resources', iconName);
  let icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (process.platform === 'darwin' && !icon.isEmpty()) {
    icon = icon.resize({width: 18, height: 18});
    icon.setTemplateImage(true);
  } else if (!icon.isEmpty()) {
    icon = icon.resize({width: 20, height: 20});
  }
  tray = new Tray(icon);
  tray.setToolTip(isChinese() ? 'Codex 额度悬浮层' : 'Codex Quota Overlay');
  tray.on('double-click', showDashboard);
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const positionMenu = [
    menuItem(isChinese() ? '上移 2 px' : 'Move up 2 px', () => adjustPlacement(0, -2)),
    menuItem(isChinese() ? '下移 2 px' : 'Move down 2 px', () => adjustPlacement(0, 2)),
    menuItem(isChinese() ? '左移 4 px' : 'Move left 4 px', () => adjustPlacement(-4, 0)),
    menuItem(isChinese() ? '右移 4 px' : 'Move right 4 px', () => adjustPlacement(4, 0)),
    {type: 'separator'},
    menuItem(isChinese() ? '恢复默认位置' : 'Reset position', () => {
      settings.update({placement: {x: 0, y: 0}});
      if (currentTargetBounds) positionOverlay(currentTargetBounds);
    })
  ];
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    {label: `Codex Quota Overlay v${VERSION}`, enabled: false},
    {type: 'separator'},
    menuItem(isChinese() ? '打开 Quota Center…' : 'Open Quota Center…', showDashboard),
    menuItem(isChinese() ? '立即刷新' : 'Refresh now', () => requestQuota(true)),
    {
      label: isChinese() ? '悬浮条信息密度' : 'Overlay detail',
      submenu: [
        overlayModeItem('compact', isChinese() ? '精简' : 'Compact'),
        overlayModeItem('balanced', isChinese() ? '标准' : 'Balanced'),
        overlayModeItem('insight', isChinese() ? '洞察' : 'Insight')
      ]
    },
    {
      label: isChinese() ? '悬浮条主题' : 'Overlay theme',
      submenu: ['dark', 'light'].map((theme) => ({
        label: theme === 'dark' ? (isChinese() ? '深色' : 'Dark') : isChinese() ? '浅色' : 'Light',
        type: 'radio',
        checked: settings.get().overlayTheme === theme,
        click: () => applyPreferences({overlayTheme: theme})
      }))
    },
    {
      label: isChinese() ? '智能提醒' : 'Smart alerts',
      submenu: [
        {
          label: isChinese() ? '启用提醒' : 'Enable alerts',
          type: 'checkbox',
          checked: settings.get().alerts.enabled,
          click: (item) => applyPreferences({alerts: {enabled: item.checked}})
        },
        {type: 'separator'},
        alertThresholdItem(10),
        alertThresholdItem(20),
        alertThresholdItem(30)
      ]
    },
    {
      label: isChinese() ? '保存 30 天本地历史' : 'Save 30-day local history',
      type: 'checkbox',
      checked: settings.get().history.enabled,
      click: (item) => applyPreferences({history: {enabled: item.checked}})
    },
    {
      label: isChinese() ? '登录时自动启动' : 'Start at login',
      type: 'checkbox',
      checked: startupEnabled(app),
      click: (item) => {
        try {
          setStartupEnabled(app, item.checked);
        } catch (error) {
          diagnostics.set('E04', error?.code ?? error?.name);
        }
        rebuildTrayMenu();
      }
    },
    {label: isChinese() ? '位置微调' : 'Position adjustment', submenu: positionMenu},
    {
      label: isChinese() ? 'Codex CLI' : 'Codex CLI',
      submenu: [
        menuItem(isChinese() ? '手动选择…' : 'Choose manually…', chooseCodexCli),
        menuItem(isChinese() ? '恢复自动检测' : 'Use automatic detection', () => {
          settings.update({codexCliPath: null});
          stopRpc();
          ensureRpc();
        })
      ]
    },
    {
      label: telemetry.configured
        ? isChinese()
          ? '匿名每日心跳'
          : 'Anonymous daily heartbeat'
        : isChinese()
          ? '匿名统计（当前版本未配置）'
          : 'Anonymous analytics (not configured)',
      type: 'checkbox',
      enabled: telemetry.configured,
      checked: telemetry.enabled,
      click: (item) => {
        settings.update({telemetryEnabled: item.checked});
        if (item.checked) telemetry.sendIfDue(true);
      }
    },
    {type: 'separator'},
    menuItem(isChinese() ? '复制简短诊断信息' : 'Copy short diagnostics', () =>
      clipboard.writeText(diagnostics.short())
    ),
    menuItem(isChinese() ? '隐私说明' : 'Privacy', () =>
      shell.openExternal('https://github.com/cpys/codex-quota-overlay/blob/main/PRIVACY.zh-CN.md')
    ),
    menuItem(isChinese() ? '检查更新' : 'Check for updates', () =>
      shell.openExternal('https://github.com/cpys/codex-quota-overlay/releases')
    ),
    menuItem(isChinese() ? '关于' : 'About', () =>
      dialog.showMessageBox({
        type: 'info',
        title: 'Codex Quota Overlay',
        message: `Codex Quota Overlay v${VERSION}`,
        detail: isChinese()
          ? '仅在 Codex 位于前台时显示额度。非 OpenAI 官方项目。'
          : 'Shows quota only while Codex is active. Not an official OpenAI project.'
      })
    ),
    {type: 'separator'},
    menuItem(isChinese() ? '退出' : 'Quit', quitApplication)
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function menuItem(label, click) {
  return {label, click};
}

/** @returns {import('electron').MenuItemConstructorOptions} */
function overlayModeItem(mode, label) {
  return {
    label,
    type: 'radio',
    checked: settings.get().overlayMode === mode,
    click: () => applyPreferences({overlayMode: mode})
  };
}

/** @returns {import('electron').MenuItemConstructorOptions} */
function alertThresholdItem(threshold) {
  return {
    label: isChinese() ? `低于 ${threshold}%` : `Below ${threshold}%`,
    type: 'radio',
    checked: settings.get().alerts.threshold === threshold,
    click: () => applyPreferences({alerts: {threshold}})
  };
}

async function tick() {
  if (polling || shuttingDown || !overlayWindow) return;
  polling = true;
  try {
    let windowInfo;
    try {
      windowInfo = await activeWindowProvider.getActiveWindow();
    } catch (error) {
      diagnostics.set(process.platform === 'darwin' ? 'M01' : 'W02', error?.code ?? error?.name);
      hideOverlay();
      return;
    }
    const classification = classifyTarget(windowInfo, process.platform);
    if (!classification.matched) {
      diagnostics.set(classification.code);
      setConnectionStatus('inactive');
      hideOverlay();
      if (!missingSince) missingSince = Date.now();
      if (Date.now() - missingSince >= 5000) stopRpc();
      return;
    }

    missingSince = 0;
    if (!rpc?.running) setConnectionStatus('connecting');
    currentTargetBounds = normalizeBounds(windowInfo.bounds);
    positionOverlay(currentTargetBounds);
    overlayWindow.showInactive();
    ensureRpc();
    if (Date.now() - lastQuotaReadAt >= QUOTA_REFRESH_MS) requestQuota(false);
    telemetry.sendIfDue(false);
  } finally {
    polling = false;
  }
}

function ensureRpc() {
  if (rpc?.running) return;
  stopRpc();
  const executable = findCodexExecutable({configuredPath: settings.get().codexCliPath});
  if (!executable) {
    diagnostics.set('E01');
    setConnectionStatus('error');
    sendOverlayState({text: diagnosticMessage('E01', locale), accent: '#ff6767'});
    return;
  }
  sendOverlayState({text: isChinese() ? '正在读取额度…' : 'Reading quota…', accent: '#70b2ff'});
  setConnectionStatus('connecting');
  rpc = new CodexRpcClient({executable, version: VERSION});
  rpc.on('quota', (snapshot) => {
    const now = Date.now();
    latestQuota = snapshot;
    lastQuotaUpdatedAt = now;
    history.record(snapshot, now);
    latestInsights = calculateQuotaInsights(history.getSamples(), snapshot, now);
    const view = quotaView(snapshot, locale, new Date(now), {
      mode: settings.get().overlayMode,
      insights: latestInsights
    });
    diagnostics.clear();
    setConnectionStatus('ready');
    sendOverlayState(view);
    tray?.setToolTip(isChinese() ? `Codex 剩余 ${view.remaining}%` : `Codex ${view.remaining}% left`);
    showQuotaAlerts(alerts.evaluate(snapshot, latestInsights, settings.get().alerts));
    broadcastDashboardState();
  });
  rpc.on('usage', (snapshot) => {
    latestUsage = snapshot;
    lastUsageReadAt = Date.now();
    broadcastDashboardState();
  });
  rpc.on('usage-unavailable', () => {
    broadcastDashboardState();
  });
  rpc.on('failure', (failure) => {
    diagnostics.set(failure.code, failure.detail);
    setConnectionStatus('error');
    sendOverlayState({text: diagnosticMessage(failure.code, locale), accent: '#ff6767'});
    broadcastDashboardState();
  });
  rpc.start();
  lastQuotaReadAt = Date.now();
  lastUsageReadAt = Date.now();
}

function requestQuota(force) {
  if (!rpc?.running) {
    ensureRpc();
    return;
  }
  if (!force && Date.now() - lastQuotaReadAt < 20_000) return;
  if (rpc.requestRateLimits()) lastQuotaReadAt = Date.now();
  if (force || Date.now() - lastUsageReadAt >= USAGE_REFRESH_MS) {
    if (rpc.requestUsage()) lastUsageReadAt = Date.now();
  }
}

function stopRpc() {
  rpc?.removeAllListeners();
  rpc?.stop();
  rpc = null;
}

function sendOverlayState(state) {
  latestOverlayState = state;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const payload = {
    text: String(state.text),
    accent: state.accent || '#70b2ff',
    locale,
    theme: settings?.get().overlayTheme || 'dark',
    mode: state.mode || settings?.get().overlayMode || 'balanced',
    remaining: Number.isFinite(state.remaining) ? state.remaining : null,
    status: state.status || 'unknown'
  };
  if (overlayWindow.webContents.isLoading()) {
    overlayWindow.webContents.once('did-finish-load', () =>
      overlayWindow?.webContents.send('overlay:state', payload)
    );
  } else {
    overlayWindow.webContents.send('overlay:state', payload);
  }
}

function normalizeBounds(bounds) {
  if (process.platform === 'darwin') return {...bounds};
  if (process.platform === 'win32' && typeof screen.screenToDipPoint === 'function') {
    const topLeft = screen.screenToDipPoint({x: Math.round(bounds.x), y: Math.round(bounds.y)});
    const bottomRight = screen.screenToDipPoint({
      x: Math.round(bounds.x + bounds.width),
      y: Math.round(bounds.y + bounds.height)
    });
    return {x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y};
  }
  return {...bounds};
}

function positionOverlay(targetBounds) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const point = placeOverlay(targetBounds, overlaySize, settings.get().placement);
  overlayWindow.setBounds({...point, ...overlaySize}, false);
  overlayWindow.moveTop();
}

function adjustPlacement(xDelta, yDelta) {
  const current = settings.get().placement;
  settings.update({
    placement: {x: clamp(current.x + xDelta, -80, 80), y: clamp(current.y + yDelta, -40, 40)}
  });
  if (currentTargetBounds) positionOverlay(currentTargetBounds);
}

async function chooseCodexCli() {
  const result = await dialog.showOpenDialog({
    title: isChinese() ? '选择 Codex CLI 可执行文件' : 'Choose the Codex CLI executable',
    defaultPath: settings.get().codexCliPath || app.getPath('home'),
    properties: ['openFile'],
    filters: process.platform === 'win32' ? [{name: 'Codex CLI', extensions: ['exe']}] : []
  });
  if (result.canceled || !result.filePaths[0]) return;
  const selected = findCodexExecutable({configuredPath: result.filePaths[0]});
  if (!selected) {
    diagnostics.set('E01');
    return;
  }
  settings.update({codexCliPath: selected});
  stopRpc();
  ensureRpc();
}

function hideOverlay() {
  currentTargetBounds = null;
  if (overlayWindow?.isVisible()) overlayWindow.hide();
}

function quitApplication() {
  if (shuttingDown) return;
  cleanup();
  tray?.destroy();
  dashboardWindow?.destroy();
  overlayWindow?.destroy();
  app.exit(0);
}

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (pollTimer) clearInterval(pollTimer);
  stopRpc();
  activeWindowProvider?.stop();
}

async function showDashboard() {
  if (shuttingDown) return;
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    broadcastDashboardState();
    return;
  }
  try {
    await createDashboardWindow();
  } catch (error) {
    diagnostics.set('E04', error?.code ?? error?.name);
  }
}

async function createDashboardWindow({show = true} = {}) {
  const rendererPath = path.join(__dirname, 'renderer', 'dashboard.html');
  const rendererUrl = pathToFileURL(rendererPath).href;
  dashboardWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    show: false,
    backgroundColor: '#0b0e14',
    autoHideMenuBar: true,
    title: 'Codex Quota Center',
    webPreferences: {
      preload: path.join(__dirname, 'dashboard-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  dashboardWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  dashboardWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== rendererUrl) event.preventDefault();
  });
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
  await dashboardWindow.loadFile(rendererPath);
  if (show) {
    dashboardWindow.show();
    dashboardWindow.focus();
  }
  broadcastDashboardState();
  return dashboardWindow;
}

function registerDashboardIpc() {
  if (dashboardIpcRegistered) return;
  dashboardIpcRegistered = true;
  ipcMain.handle('dashboard:get-state', (event) => {
    assertDashboardSender(event);
    return dashboardState();
  });
  ipcMain.handle('dashboard:update-settings', (event, patch) => {
    assertDashboardSender(event);
    applyPreferences(filterDashboardPatch(patch));
    return dashboardState();
  });
  ipcMain.handle('dashboard:clear-history', (event) => {
    assertDashboardSender(event);
    history.clear();
    latestInsights = latestQuota ? calculateQuotaInsights([], latestQuota) : null;
    renderLatestQuota();
    broadcastDashboardState();
    return dashboardState();
  });
  ipcMain.handle('dashboard:refresh', (event) => {
    assertDashboardSender(event);
    requestQuota(true);
    return dashboardState();
  });
  ipcMain.handle('dashboard:copy-diagnostics', (event) => {
    assertDashboardSender(event);
    clipboard.writeText(diagnostics.short());
    return true;
  });
}

function assertDashboardSender(event) {
  const rendererUrl = pathToFileURL(path.join(__dirname, 'renderer', 'dashboard.html')).href;
  if (
    !dashboardWindow ||
    dashboardWindow.isDestroyed() ||
    event.sender !== dashboardWindow.webContents ||
    event.senderFrame?.url !== rendererUrl
  ) {
    throw new Error('Invalid dashboard IPC sender');
  }
}

function filterDashboardPatch(patch) {
  const filtered = {};
  if (['dark', 'light'].includes(patch?.overlayTheme)) {
    filtered.overlayTheme = patch.overlayTheme;
  }
  if (['compact', 'balanced', 'insight'].includes(patch?.overlayMode)) {
    filtered.overlayMode = patch.overlayMode;
  }
  if (patch?.history && typeof patch.history === 'object') {
    filtered.history = {};
    if (typeof patch.history.enabled === 'boolean') filtered.history.enabled = patch.history.enabled;
    if ([7, 14, 30, 90].includes(Number(patch.history.retentionDays))) {
      filtered.history.retentionDays = Number(patch.history.retentionDays);
    }
  }
  if (patch?.alerts && typeof patch.alerts === 'object') {
    filtered.alerts = {};
    if (typeof patch.alerts.enabled === 'boolean') filtered.alerts.enabled = patch.alerts.enabled;
    if ([10, 20, 30].includes(Number(patch.alerts.threshold))) {
      filtered.alerts.threshold = Number(patch.alerts.threshold);
    }
    if (typeof patch.alerts.paceRisk === 'boolean') filtered.alerts.paceRisk = patch.alerts.paceRisk;
  }
  return filtered;
}

function applyPreferences(patch) {
  const before = settings.get();
  const next = settings.update(patch);
  history.setRetentionDays(next.history.retentionDays);
  history.setEnabled(next.history.enabled);
  if (JSON.stringify(before.alerts) !== JSON.stringify(next.alerts)) alerts.reset();
  if (latestQuota) latestInsights = calculateQuotaInsights(history.getSamples(), latestQuota);
  renderLatestQuota();
  rebuildTrayMenu();
  broadcastDashboardState();
}

function renderLatestQuota() {
  if (!latestQuota) {
    if (latestOverlayState) sendOverlayState(latestOverlayState);
    return;
  }
  sendOverlayState(
    quotaView(latestQuota, locale, new Date(), {
      mode: settings.get().overlayMode,
      insights: latestInsights
    })
  );
}

function dashboardState() {
  const preferences = settings?.get();
  const historyStatus = history?.status ?? {enabled: false, retentionDays: 30, sampleCount: 0};
  const points = (history?.getSamples() ?? []).slice(-500).map((sample) => ({
    at: sample.at,
    limitId: sample.limitId,
    resetsAt: sample.resetsAt,
    usedPercent: sample.usedPercent
  }));
  return {
    version: VERSION,
    locale,
    now: Date.now(),
    connection: connectionStatus,
    diagnostic: diagnostics?.short() ?? 'W01 | Waiting',
    quota: latestQuota ?? null,
    usage: latestUsage ?? null,
    insights: latestInsights ?? null,
    updatedAt: lastQuotaUpdatedAt || null,
    history: {...historyStatus, points},
    preferences: preferences
      ? {
          overlayMode: preferences.overlayMode,
          overlayTheme: preferences.overlayTheme,
          history: preferences.history,
          alerts: preferences.alerts
        }
      : null
  };
}

function broadcastDashboardState() {
  if (!dashboardWindow || dashboardWindow.isDestroyed() || dashboardWindow.webContents.isLoading()) return;
  dashboardWindow.webContents.send('dashboard:state', dashboardState());
}

function setConnectionStatus(value) {
  if (connectionStatus === value) return;
  connectionStatus = value;
  broadcastDashboardState();
}

function showQuotaAlerts(events) {
  if (!events.length || !Notification.isSupported()) return;
  for (const event of events) {
    let title;
    let body;
    if (event.kind === 'threshold') {
      title = isChinese() ? 'Codex 额度偏低' : 'Codex quota is low';
      body = isChinese()
        ? `当前剩余 ${event.remaining}%，达到你设置的 ${event.threshold}% 提醒线。`
        : `${event.remaining}% remains, at your ${event.threshold}% alert threshold.`;
    } else {
      title = isChinese() ? '当前消耗速度偏快' : 'Current quota pace is high';
      body = isChinese()
        ? '按最近速度，额度可能在重置前用尽。可打开 Quota Center 查看预测。'
        : 'At the recent pace, quota may run out before reset. Open Quota Center for the forecast.';
    }
    const notification = new Notification({title, body});
    notification.on('click', showDashboard);
    notification.show();
  }
}

function isChinese() {
  return locale.toLowerCase().startsWith('zh');
}

function platformName() {
  return process.platform === 'win32' ? 'windows' : 'macos';
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
