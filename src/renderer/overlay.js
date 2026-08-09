const card = document.querySelector('#card');
const text = document.querySelector('#text');

function reportSize() {
  const bounds = card.getBoundingClientRect();
  window.quotaOverlay.measured({width: Math.ceil(bounds.width), height: Math.ceil(bounds.height)});
}

window.quotaOverlay.onState(state => {
  text.textContent = state.text;
  card.style.setProperty('--accent', state.accent);
  document.documentElement.lang = state.locale || 'zh-CN';
  requestAnimationFrame(reportSize);
});

new ResizeObserver(reportSize).observe(card);
reportSize();
