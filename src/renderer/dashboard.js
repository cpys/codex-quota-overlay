const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** @type {any} */
let currentState = null;
let toastTimer;

const api = window.quotaCenter;
const element = (id) => document.getElementById(id);
const inputElement = (id) => /** @type {HTMLInputElement} */ (element(id));
const selectElement = (id) => /** @type {HTMLSelectElement} */ (element(id));
const buttonElement = (id) => /** @type {HTMLButtonElement} */ (element(id));

/** @returns {NodeListOf<HTMLButtonElement>} */
function overlayModeButtons() {
  return /** @type {NodeListOf<HTMLButtonElement>} */ (
    document.querySelectorAll('#overlay-mode-control button')
  );
}

bindInteractions();
initialize();

async function initialize() {
  if (!api) {
    showToast('Dashboard bridge unavailable');
    return;
  }
  try {
    render(await api.getState());
    api.onState(render);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Unable to load dashboard');
  }
}

function render(state) {
  if (!state) return;
  currentState = state;
  const zh = isChinese(state.locale);
  document.documentElement.lang = state.locale || 'zh-CN';
  localizeStatic(zh);
  renderConnection(state, zh);
  renderQuota(state, zh);
  renderInsights(state, zh);
  renderHistory(state, zh);
  renderWindows(state, zh);
  renderActivity(state, zh);
  renderPreferences(state, zh);
  element('diagnostic-code').textContent = state.diagnostic || 'W01 | Waiting';
}

function renderConnection(state, zh) {
  const labels = {
    ready: zh ? '数据已同步' : 'Synced',
    connecting: zh ? '正在连接' : 'Connecting',
    inactive: zh ? '等待 Codex 前台' : 'Waiting for Codex',
    error: zh ? '需要处理' : 'Needs attention'
  };
  element('connection-pill').dataset.status = state.connection || 'inactive';
  element('connection-text').textContent = labels[state.connection] || labels.inactive;
}

function renderQuota(state, zh) {
  const quota = state.quota;
  const remaining = quota ? Math.round(clamp(100 - quota.usedPercent, 0, 100)) : null;
  element('remaining-value').textContent = remaining === null ? '--' : `${remaining}%`;
  element('quota-ring').style.setProperty('--remaining', String(remaining ?? 0));
  element('quota-ring').style.setProperty('--ring-color', remainingColor(remaining));
  element('quota-title').textContent = quota?.limitName || quota?.limitId || 'Codex';
  element('reset-countdown').textContent = quota
    ? countdown(quota.resetsAt, state.now, zh)
    : zh
      ? '打开 Codex 后读取额度'
      : 'Open Codex to read quota';
  element('reset-moment').textContent = quota
    ? `${formatDateTime(quota.resetsAt * 1000, state.locale)} ${zh ? '重置' : 'reset'}`
    : zh
      ? '仪表盘不会读取会话、项目或账户内容。'
      : 'The dashboard never reads chats, projects, or account content.';
  element('updated-label').textContent = state.updatedAt
    ? `${zh ? '更新于' : 'Updated'} ${formatTime(state.updatedAt, state.locale)}`
    : zh
      ? '尚未读取'
      : 'Not read yet';
}

function renderInsights(state, zh) {
  const insights = state.insights;
  const status = insights?.status || 'learning';
  element('pace-badge').dataset.status = status;
  element('pace-badge').textContent = paceLabel(status, zh);
  element('burn-value').textContent = rateLabel(insights?.burnRatePerHour, zh);
  element('safe-value').textContent = rateLabel(insights?.safeRatePerHour, zh);
  element('forecast-value').textContent = insights?.exhaustsAt
    ? formatTime(insights.exhaustsAt, state.locale)
    : zh
      ? '不会提前用尽'
      : 'Not before reset';
  element('forecast-detail').textContent =
    status === 'risk'
      ? zh
        ? '按最近速度会早于重置时间'
        : 'Recent pace runs out before reset'
      : zh
        ? '基于当前周期最近采样'
        : 'Based on recent samples this cycle';
  element('confidence-value').textContent = confidenceLabel(insights?.confidence, zh);
  element('confidence-detail').textContent = zh
    ? `当前周期 ${insights?.sampleCount || 0} 个采样点 · ${insights?.spanMinutes || 0} 分钟`
    : `${insights?.sampleCount || 0} samples · ${insights?.spanMinutes || 0} minutes`;
}

function renderHistory(state, zh) {
  const history = state.history || {points: [], enabled: false};
  element('history-mode').textContent = history.enabled
    ? zh
      ? `本地保留 ${history.retentionDays} 天`
      : `${history.retentionDays}-day local history`
    : zh
      ? '仅本次运行'
      : 'This session only';
  const points = (history.points || []).filter(
    (point) =>
      !state.quota ||
      (point.limitId === state.quota.limitId &&
        (!state.quota.resetsAt || point.resetsAt === state.quota.resetsAt))
  );
  drawHistoryChart(points, state.locale);
}

function drawHistoryChart(points, locale) {
  const svg = element('history-chart');
  while (svg.firstChild) svg.firstChild.remove();
  const empty = element('history-empty');
  if (points.length < 2) {
    empty.hidden = false;
    element('chart-start').textContent = '--';
    element('chart-end').textContent = '--';
    return;
  }
  empty.hidden = true;
  const width = 760;
  const height = 220;
  const padding = {left: 24, right: 24, top: 20, bottom: 20};
  const minimumTime = points[0].at;
  const maximumTime = points.at(-1).at;
  const span = Math.max(1, maximumTime - minimumTime);
  const x = (point) =>
    padding.left + ((point.at - minimumTime) / span) * (width - padding.left - padding.right);
  const y = (point) =>
    padding.top +
    ((100 - (100 - clamp(point.usedPercent, 0, 100))) / 100) * (height - padding.top - padding.bottom);

  for (const level of [0, 25, 50, 75, 100]) {
    const line = createSvg('line', {
      x1: padding.left,
      x2: width - padding.right,
      y1: padding.top + (level / 100) * (height - padding.top - padding.bottom),
      y2: padding.top + (level / 100) * (height - padding.top - padding.bottom),
      class: 'chart-grid'
    });
    svg.append(line);
  }

  const linePath = points
    .map((point, index) => `${index ? 'L' : 'M'} ${x(point).toFixed(1)} ${y(point).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${x(points.at(-1)).toFixed(1)} ${height - padding.bottom} L ${x(points[0]).toFixed(1)} ${height - padding.bottom} Z`;
  svg.append(createSvg('path', {d: areaPath, class: 'chart-area'}));
  svg.append(createSvg('path', {d: linePath, class: 'chart-line'}));
  svg.append(
    createSvg('circle', {
      cx: x(points.at(-1)).toFixed(1),
      cy: y(points.at(-1)).toFixed(1),
      r: 4,
      class: 'chart-point'
    })
  );
  element('chart-start').textContent = formatTime(minimumTime, locale);
  element('chart-end').textContent = formatTime(maximumTime, locale);
}

function renderWindows(state, zh) {
  const container = element('quota-windows');
  container.replaceChildren();
  const buckets = state.quota?.buckets || [];
  element('window-count').textContent = zh ? `${buckets.length} 个` : `${buckets.length} total`;
  element('windows-empty').hidden = buckets.length > 0;
  for (const bucket of buckets) {
    const card = document.createElement('article');
    card.className = 'window-card';
    const header = document.createElement('div');
    header.className = 'window-card-header';
    const title = document.createElement('strong');
    title.textContent = bucket.limitName || bucket.limitId || 'Codex';
    const count = document.createElement('span');
    count.textContent = zh ? `${bucket.windows.length} 个周期` : `${bucket.windows.length} windows`;
    header.append(title, count);
    card.append(header);
    for (const windowInfo of bucket.windows) {
      const row = document.createElement('div');
      row.className = 'window-row';
      const label = document.createElement('span');
      label.textContent =
        windowInfo.kind === 'primary' ? (zh ? '主要' : 'Primary') : zh ? '次要' : 'Secondary';
      const track = document.createElement('div');
      track.className = 'progress-track';
      const fill = document.createElement('div');
      const remaining = Math.round(clamp(100 - windowInfo.usedPercent, 0, 100));
      fill.className = 'progress-fill';
      fill.style.width = `${remaining}%`;
      fill.style.setProperty('--progress-color', remainingColor(remaining));
      track.append(fill);
      const detail = document.createElement('span');
      detail.textContent = `${remaining}% · ${formatTime(windowInfo.resetsAt * 1000, state.locale)}`;
      row.append(label, track, detail);
      card.append(row);
    }
    container.append(card);
  }
}

function renderActivity(state, zh) {
  const usage = state.usage;
  const summary = element('activity-summary');
  const bars = element('usage-bars');
  summary.replaceChildren();
  bars.replaceChildren();
  element('activity-empty').hidden = Boolean(usage);
  if (!usage) {
    summary.hidden = true;
    bars.hidden = true;
    element('streak-badge').textContent = zh ? '-- 天连续' : '-- day streak';
    return;
  }
  summary.hidden = false;
  bars.hidden = usage.dailyUsageBuckets.length === 0;
  const metrics = [
    [zh ? '累计 Token' : 'Lifetime tokens', usage.summary.lifetimeTokens],
    [zh ? '单日峰值' : 'Peak day', usage.summary.peakDailyTokens],
    [zh ? '最长任务' : 'Longest turn', durationLabel(usage.summary.longestRunningTurnSec, zh)],
    [zh ? '最长连续' : 'Longest streak', dayLabel(usage.summary.longestStreakDays, zh)]
  ];
  for (const [label, value] of metrics) {
    const metric = document.createElement('div');
    metric.className = 'activity-metric';
    const name = document.createElement('span');
    name.textContent = label;
    const content = document.createElement('strong');
    content.textContent = typeof value === 'number' ? compactNumber(value, state.locale) : value || '--';
    metric.append(name, content);
    summary.append(metric);
  }
  element('streak-badge').textContent = dayLabel(usage.summary.currentStreakDays, zh);
  const recent = usage.dailyUsageBuckets.slice(-14);
  const maximum = Math.max(...recent.map((bucket) => bucket.tokens), 1);
  for (const bucket of recent) {
    const bar = document.createElement('span');
    bar.className = 'usage-bar';
    bar.style.height = `${Math.max(7, (bucket.tokens / maximum) * 100)}%`;
    bar.title = `${bucket.startDate}: ${compactNumber(bucket.tokens, state.locale)}`;
    bars.append(bar);
  }
}

function renderPreferences(state, zh) {
  const preferences = state.preferences;
  if (!preferences) return;
  for (const button of overlayModeButtons()) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === preferences.overlayMode));
  }
  inputElement('alerts-enabled').checked = preferences.alerts.enabled;
  selectElement('alert-threshold').value = String(preferences.alerts.threshold);
  inputElement('history-enabled').checked = preferences.history.enabled;
  selectElement('history-retention').value = String(preferences.history.retentionDays);
  element('save-state').textContent = zh ? '自动保存' : 'Saved automatically';
}

function bindInteractions() {
  element('refresh-button').addEventListener('click', () => runAction('refresh'));
  element('copy-diagnostics-button').addEventListener('click', () => runAction('copy'));
  for (const button of overlayModeButtons()) {
    button.addEventListener('click', () => runAction('settings', {overlayMode: button.dataset.mode}));
  }
  const alertsEnabled = inputElement('alerts-enabled');
  const alertThreshold = selectElement('alert-threshold');
  const historyEnabled = inputElement('history-enabled');
  const historyRetention = selectElement('history-retention');
  alertsEnabled.addEventListener('change', () =>
    runAction('settings', {alerts: {enabled: alertsEnabled.checked}})
  );
  alertThreshold.addEventListener('change', () =>
    runAction('settings', {alerts: {threshold: Number(alertThreshold.value)}})
  );
  historyEnabled.addEventListener('change', () =>
    runAction('settings', {history: {enabled: historyEnabled.checked}})
  );
  historyRetention.addEventListener('change', () =>
    runAction('settings', {history: {retentionDays: Number(historyRetention.value)}})
  );
  element('clear-history-button').addEventListener('click', () => {
    element('clear-confirm').hidden = false;
  });
  element('cancel-clear-button').addEventListener('click', () => {
    element('clear-confirm').hidden = true;
  });
  element('confirm-clear-button').addEventListener('click', () => runAction('clear'));
}

async function runAction(action, patch) {
  if (!api) return;
  const refreshButton = buttonElement('refresh-button');
  try {
    if (action === 'refresh') {
      refreshButton.disabled = true;
      render(await api.refresh());
      showToast(isChinese(currentState?.locale) ? '已请求最新数据' : 'Latest data requested');
    } else if (action === 'copy') {
      await api.copyDiagnostics();
      showToast(isChinese(currentState?.locale) ? '诊断信息已复制' : 'Diagnostics copied');
    } else if (action === 'clear') {
      render(await api.clearHistory());
      element('clear-confirm').hidden = true;
      showToast(isChinese(currentState?.locale) ? '历史已清空' : 'History cleared');
    } else {
      render(await api.updateSettings(patch));
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Action failed');
  } finally {
    refreshButton.disabled = false;
  }
}

function localizeStatic(zh) {
  const copy = {
    'local-badge': ['仅本机', 'Local only'],
    subtitle: ['把额度数字变成可执行的使用节奏', 'Turn quota numbers into an actionable pace'],
    'refresh-button': ['立即刷新', 'Refresh now'],
    'current-window-label': ['当前额度窗口', 'Current quota window'],
    'remaining-label': ['剩余', 'remaining'],
    'burn-label': ['当前消耗', 'Current burn'],
    'safe-label': ['安全速度', 'Safe pace'],
    'forecast-label': ['预计用尽', 'Estimated empty'],
    'confidence-label': ['预测可信度', 'Forecast confidence'],
    'trend-eyebrow': ['额度趋势', 'Quota trend'],
    'trend-title': ['本周期剩余比例', 'Remaining in this cycle'],
    'chart-caption': ['剩余额度', 'Quota remaining'],
    'windows-eyebrow': ['所有限制', 'All limits'],
    'windows-title': ['额度窗口', 'Quota windows'],
    'activity-eyebrow': ['只读统计', 'Read-only stats'],
    'activity-title': ['Codex 活跃度', 'Codex activity'],
    'preferences-eyebrow': ['偏好设置', 'Preferences'],
    'preferences-title': ['显示、提醒与隐私', 'Display, alerts, and privacy'],
    'overlay-density-title': ['悬浮条信息密度', 'Overlay detail'],
    'overlay-density-description': [
      '精简适合小窗口，洞察模式会加入消耗速度。',
      'Compact fits small windows; Insight adds pace information.'
    ],
    'alerts-title': ['智能提醒', 'Smart alerts'],
    'alerts-description': [
      '低额度或预测提前用尽时，每个周期只提醒一次。',
      'Notify once per cycle for low quota or predicted early exhaustion.'
    ],
    'threshold-label': ['提醒线', 'Threshold'],
    'alerts-enabled-label': ['启用', 'Enabled'],
    'history-title': ['本地历史', 'Local history'],
    'history-description': [
      '默认只保留本次运行；开启后仅保存额度百分比和时间。',
      'Session-only by default; opt in to save only percentages and timestamps.'
    ],
    'retention-label': ['保留', 'Keep'],
    'history-enabled-label': ['落盘', 'Persist'],
    'clear-history-button': ['清空', 'Clear'],
    'clear-confirm-text': [
      '确定清空本次运行和本地历史吗？此操作无法撤销。',
      'Clear session and local history? This cannot be undone.'
    ],
    'cancel-clear-button': ['取消', 'Cancel'],
    'confirm-clear-button': ['确认清空', 'Clear now'],
    'diagnostic-label': ['短诊断', 'Short diagnostics'],
    'privacy-note': [
      '不含账户、路径、会话、Token 或原始响应',
      'No accounts, paths, chats, tokens, or raw responses'
    ],
    'copy-diagnostics-button': ['复制', 'Copy']
  };
  for (const [id, values] of Object.entries(copy)) element(id).textContent = zh ? values[0] : values[1];
  for (const button of overlayModeButtons()) {
    const labels = {
      compact: ['精简', 'Compact'],
      balanced: ['标准', 'Balanced'],
      insight: ['洞察', 'Insight']
    };
    button.textContent = zh ? labels[button.dataset.mode][0] : labels[button.dataset.mode][1];
  }
  for (const option of selectElement('history-retention').options) {
    option.textContent = `${option.value} ${zh ? '天' : 'days'}`;
  }
}

function createSvg(name, attributes) {
  const node = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function showToast(message) {
  const toast = element('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function paceLabel(status, zh) {
  const labels = {
    learning: ['正在学习节奏', 'Learning your pace'],
    steady: ['当前消耗平稳', 'Usage is steady'],
    'on-track': ['按当前节奏可持续', 'On track through reset'],
    tight: ['接近安全速度', 'Near the safe pace'],
    risk: ['可能提前用尽', 'May run out early'],
    exhausted: ['额度已用尽', 'Quota exhausted']
  };
  return (labels[status] || labels.learning)[zh ? 0 : 1];
}

function confidenceLabel(value, zh) {
  const labels = {
    high: ['高', 'High'],
    medium: ['中', 'Medium'],
    low: ['初步', 'Early'],
    none: ['学习中', 'Learning']
  };
  return (labels[value] || labels.none)[zh ? 0 : 1];
}

function rateLabel(value, zh) {
  return Number.isFinite(value)
    ? `${value >= 10 ? Math.round(value) : value.toFixed(1)}%${zh ? '/时' : '/h'}`
    : '--';
}

function countdown(unixSeconds, now, zh) {
  if (!unixSeconds) return zh ? '重置时间未知' : 'Reset time unknown';
  const minutes = Math.max(0, Math.ceil((unixSeconds * 1000 - now) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  if (minutes === 0) return zh ? '即将重置' : 'Reset due now';
  if (days) return zh ? `${days} 天 ${hours} 小时后重置` : `Resets in ${days}d ${hours}h`;
  if (hours) return zh ? `${hours} 小时 ${remainder} 分后重置` : `Resets in ${hours}h ${remainder}m`;
  return zh ? `${remainder} 分钟后重置` : `Resets in ${remainder}m`;
}

function durationLabel(seconds, zh) {
  if (!Number.isFinite(seconds)) return '--';
  const minutes = Math.round(seconds / 60);
  return zh ? `${minutes} 分钟` : `${minutes} min`;
}

function dayLabel(days, zh) {
  if (!Number.isFinite(days)) return '--';
  return zh ? `${days} 天连续` : `${days} day streak`;
}

function formatDateTime(milliseconds, locale) {
  if (!milliseconds) return '--';
  return new Intl.DateTimeFormat(locale || 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(milliseconds));
}

function formatTime(milliseconds, locale) {
  if (!milliseconds) return '--';
  return new Intl.DateTimeFormat(locale || 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(milliseconds));
}

function compactNumber(value, locale) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(locale || 'en-US', {notation: 'compact', maximumFractionDigits: 1}).format(value)
    : '--';
}

function remainingColor(remaining) {
  if (remaining === null) return '#566071';
  return remaining > 50 ? '#4dd18d' : remaining > 20 ? '#f6be48' : '#ff7a72';
}

function isChinese(locale) {
  return String(locale || '')
    .toLowerCase()
    .startsWith('zh');
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
