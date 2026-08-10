export function classifyTarget(windowInfo, platform = process.platform) {
  if (!windowInfo?.owner || !validBounds(windowInfo.bounds)) {
    return {matched: false, code: platform === 'darwin' ? 'M01' : 'W02'};
  }

  const ownerName = lower(windowInfo.owner.name);
  const ownerPath = lower(windowInfo.owner.path);
  const bundleId = lower(windowInfo.owner.bundleId);

  if (platform === 'win32') {
    const pathMatch =
      ownerPath.includes('\\openai\\codex\\') ||
      ownerPath.includes('\\programs\\codex\\') ||
      ownerPath.includes('\\windowsapps\\openai.codex_') ||
      ownerPath.includes('\\openai.codex_');
    const nameMatch = ['codex', 'chatgpt'].includes(ownerName) && pathMatch;
    return {matched: nameMatch || pathMatch, code: nameMatch || pathMatch ? 'OK' : 'W02', kind: 'desktop'};
  }

  if (platform === 'darwin') {
    const bundleMatch = ['com.openai.chat', 'com.openai.chatgpt', 'com.openai.codex'].includes(bundleId);
    const nameMatch = ownerName === 'codex' || ownerName === 'chatgpt';
    return {
      matched: bundleMatch || nameMatch,
      code: bundleMatch || nameMatch ? 'OK' : 'M01',
      kind: 'desktop'
    };
  }

  return {matched: false, code: 'W02'};
}

function validBounds(bounds) {
  return (
    Number.isFinite(bounds?.x) &&
    Number.isFinite(bounds?.y) &&
    Number.isFinite(bounds?.width) &&
    Number.isFinite(bounds?.height) &&
    bounds.width > 300 &&
    bounds.height > 200
  );
}

const lower = (value) => String(value ?? '').toLowerCase();
