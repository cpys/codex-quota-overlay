const translations = {
  'zh-CN': {
    skip: '跳到正文',
    navPreview: '效果预览',
    navHow: '工作方式',
    navPrivacy: '隐私',
    navDownload: '下载',
    heroTitle: 'Codex 额度，<br>始终一眼可见。',
    heroLede: '一个小巧、重视隐私的 Codex Desktop 额度悬浮层，支持 Windows 和 macOS。',
    downloadLatest: '下载最新版',
    viewGitHub: '查看 GitHub',
    featurePlacement: '原生位置',
    featurePlacementBody: '准确显示在会话标题旁。',
    featureLocal: '默认本地运行',
    featureLocalBody: '额度数据留在你的设备上。',
    featurePlatforms: 'Windows + macOS',
    featurePlatformsBody: '一个小工具，两个平台。',
    previewAlt: '经过隐私打码的 Codex Desktop 窗口，会话标题旁清晰显示单行额度悬浮层',
    previewCaption: '真实位置，隐私内容已打码。',
    workflowTitle: '一行信息，恰好出现在需要的位置。',
    step1: '识别 Codex',
    step1Body: '识别官方 Codex Desktop 窗口，但不读取会话标题。',
    step2: '读取本地额度',
    step2Body: '通过官方公开的本地 App Server 获取额度信息。',
    step3: '不打扰工作',
    step3Body: 'Codex 不在前台时立即隐藏。',
    detailTitle: '刻意小巧，<br>信息清晰。',
    detailBody: '剩余额度、下次重置时间和可用 Reset 卡集中在一行，无需额外窗口，也不必切换上下文。',
    detailPoint1: '鼠标穿透，不抢焦点',
    detailPoint2: '适配高 DPI 和多显示器',
    detailPoint3: '托盘或菜单栏位置微调',
    detailAlt: 'Codex 额度悬浮层与已打码的会话标题对齐',
    privacyTitle: '不抓取账户。<br>不上传秘密。',
    privacyBody: '读取额度、识别前台窗口和定位都在本机完成。公开版本没有配置统计服务地址。',
    privacyBody2: '项目主页没有统计脚本、Cookie、表单或追踪像素。',
    privacyLink: '阅读完整隐私说明 →',
    platformTitle: '选择你的平台',
    windowsBody: 'x64 安装程序',
    architecture: '架构',
    download: '下载',
    unsignedNote: '当前为未签名测试包。打开前请在 GitHub 校验 SHA-256。',
    requirements: '查看系统要求 →',
    footer: 'MIT 许可 · 与 OpenAI 无隶属关系',
    support: '支持',
    security: '安全',
    releases: '版本'
  }
};

/** @type {NodeListOf<HTMLElement>} */
const translatableElements = document.querySelectorAll('[data-i18n]');
/** @type {NodeListOf<HTMLElement>} */
const translatedAltElements = document.querySelectorAll('[data-i18n-alt]');
translations.en = Object.fromEntries(
  [...translatableElements].map((element) => [element.dataset.i18n, element.innerHTML])
);
const englishAltText = Object.fromEntries(
  [...translatedAltElements].map((element) => [element.dataset.i18nAlt, element.getAttribute('alt')])
);

/** @type {HTMLButtonElement[]} */
const languageButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('[data-lang]')]);
/** @type {HTMLSelectElement} */
const macArchitecture = document.querySelector('#mac-architecture');
/** @type {HTMLAnchorElement} */
const macDownload = document.querySelector('#mac-download');
/** @type {HTMLAnchorElement} */
const privacyLink = document.querySelector('.privacy-panel > a');

function setLanguage(language) {
  const normalized = language === 'zh-CN' ? 'zh-CN' : 'en';
  const dictionary = translations[normalized] || {};
  document.documentElement.lang = normalized;
  translatableElements.forEach((element) => {
    const value = dictionary[element.dataset.i18n];
    if (value) element.innerHTML = value;
  });
  translatedAltElements.forEach((element) => {
    const value =
      normalized === 'en' ? englishAltText[element.dataset.i18nAlt] : dictionary[element.dataset.i18nAlt];
    if (value) element.setAttribute('alt', value);
  });
  privacyLink.href =
    normalized === 'zh-CN'
      ? 'https://github.com/cpys/codex-quota-overlay/blob/main/PRIVACY.zh-CN.md'
      : 'https://github.com/cpys/codex-quota-overlay/blob/main/PRIVACY.md';
  languageButtons.forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.lang === normalized))
  );
  const url = new URL(window.location.href);
  if (normalized === 'zh-CN') url.searchParams.set('lang', 'zh-CN');
  else url.searchParams.delete('lang');
  window.history.replaceState({}, '', url);
}

function updateMacDownload() {
  const architecture = macArchitecture.value === 'x64' ? 'x64' : 'arm64';
  macDownload.href = `https://github.com/cpys/codex-quota-overlay/releases/download/v0.3.0/CodexQuotaOverlay-mac-0.3.0-${architecture}.dmg`;
}

languageButtons.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
macArchitecture.addEventListener('change', updateMacDownload);

const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
const initialLanguage =
  requestedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
setLanguage(initialLanguage);
updateMacDownload();
