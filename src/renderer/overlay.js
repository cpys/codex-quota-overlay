/** @type {HTMLElement} */
const card = document.querySelector('#card');
/** @type {HTMLElement} */
const text = document.querySelector('#text');

function reportSize() {
  const bounds = card.getBoundingClientRect();
  window.quotaOverlay.measured({width: Math.ceil(bounds.width), height: Math.ceil(bounds.height)});
}

window.quotaOverlay.onState((state) => {
  text.textContent = state.text;
  card.style.setProperty('--accent', state.accent);
  card.style.setProperty('--remaining', Number.isFinite(state.remaining) ? `${state.remaining}%` : '0%');
  card.dataset.mode = state.mode || 'balanced';
  card.dataset.status = state.status || 'unknown';
  document.documentElement.dataset.theme = state.theme === 'light' ? 'light' : 'dark';
  document.documentElement.lang = state.locale || 'zh-CN';
  requestAnimationFrame(reportSize);
});

new ResizeObserver(reportSize).observe(card);
reportSize();
