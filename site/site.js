const translations = {
  'zh-CN': {
    skip: '跳到正文',
    navPreview: '效果预览',
    navHow: '工作方式',
    navPrivacy: '隐私',
    navDownload: '下载',
    heroTitle: '看见额度，<br>理解使用节奏。',
    heroLede: '面向 Windows 的 Codex Desktop 一眼悬浮条与本地 Quota Center。',
    downloadLatest: '下载最新版',
    viewGitHub: '查看 GitHub',
    featurePlacement: '一眼 + 深入',
    featurePlacementBody: '工作时只占一行，需要时展开全貌。',
    featureLocal: '节奏预测',
    featureLocalBody: '把近期消耗与到重置前的安全速度对比。',
    featurePlatforms: '默认隐私',
    featurePlatformsBody: '主动开启前，历史只存在于本次运行。',
    previewAlt: '经过隐私打码的 Codex Desktop 窗口，会话标题旁清晰显示单行额度悬浮层',
    previewCaption: '真实位置，隐私内容已打码。',
    workflowTitle: '把一个额度数字，变成可执行的使用计划。',
    step1: '识别 Codex',
    step1Body: '识别官方 Codex Desktop 窗口，但不读取会话标题。',
    step2: '读取本地信号',
    step2Body: '通过官方公开的本地 App Server 获取额度与汇总活跃度。',
    step3: '看懂当前节奏',
    step3Body: '估算安全速度和提前用尽风险，然后安静地退到一旁。',
    detailTitle: '忙碌时只占一行，<br>规划时展开全貌。',
    detailBody:
      '悬浮条保持精简；Quota Center 汇总全部限制周期、重置倒计时、近期趋势、活跃度和带可信度的用尽预测。',
    detailPoint1: '精简、标准、洞察三种悬浮模式',
    detailPoint2: '可选的低额度与节奏风险提醒',
    detailPoint3: '主动开启、有限保留、随时可清空的本地历史',
    detailAlt: 'Codex 额度悬浮层与已打码的会话标题对齐',
    privacyTitle: '不抓取账户。<br>不上传秘密。',
    privacyBody:
      '读取额度、节奏预测、识别前台窗口和定位都在本机完成。历史默认只在内存，只有主动开启后才写入有限的本地文件。',
    privacyBody2: '项目主页没有统计脚本、Cookie、表单或追踪像素。',
    privacyLink: '阅读完整隐私说明 →',
    platformTitle: '下载 Windows 版',
    windowsBody: 'x64 安装程序',
    download: '下载',
    unsignedNote: 'Windows 安装包当前未签名。打开前请在 GitHub 校验 SHA-256。',
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

languageButtons.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));

const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
const initialLanguage =
  requestedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
setLanguage(initialLanguage);
