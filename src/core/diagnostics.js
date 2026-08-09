const MESSAGES = {
  OK: ['运行正常', 'Ready'],
  E01: ['找不到 Codex CLI', 'Codex CLI not found'],
  E02: ['无法启动额度服务', 'Cannot start quota service'],
  E03: ['额度服务初始化失败', 'Quota service initialization failed'],
  E04: ['额度读取失败', 'Quota read failed'],
  E05: ['额度服务意外退出', 'Quota service exited'],
  W01: ['请先打开并切回 Codex', 'Open Codex and make it active'],
  W02: ['未识别当前 Codex 窗口', 'Active Codex window not recognized'],
  M01: ['未识别 Codex 应用身份', 'Codex application identity was not detected'],
  A01: ['悬浮条偏高', 'Overlay is too high'],
  A02: ['悬浮条偏低', 'Overlay is too low'],
  A03: ['悬浮条偏左', 'Overlay is too far left'],
  A04: ['悬浮条偏右', 'Overlay is too far right']
};

export class Diagnostics {
  constructor(locale = 'zh-CN') {
    this.locale = locale;
    this.last = {code: 'W01', detail: ''};
  }

  set(code, detail = '') {
    const safeDetail = sanitizeDetail(detail);
    this.last = {code: MESSAGES[code] ? code : 'E04', detail: safeDetail};
  }

  clear() {
    this.last = {code: 'OK', detail: ''};
  }

  short() {
    const languageIndex = this.locale.toLowerCase().startsWith('zh') ? 0 : 1;
    const base = MESSAGES[this.last.code]?.[languageIndex] ?? MESSAGES.E04[languageIndex];
    const suffix = this.last.detail ? ` | ${this.last.detail}` : '';
    return `${this.last.code} | ${base}${suffix}`.slice(0, 200);
  }
}

export function sanitizeDetail(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^ ]+/gi, '[path]')
    .replace(/[A-Fa-f0-9]{32,}/g, '[id]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);
}

export function diagnosticMessage(code, locale = 'zh-CN') {
  const languageIndex = locale.toLowerCase().startsWith('zh') ? 0 : 1;
  return MESSAGES[code]?.[languageIndex] ?? MESSAGES.E04[languageIndex];
}
