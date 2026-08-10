const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function parseQuotaResult(result) {
  const primary = result?.rateLimits?.primary;
  if (!primary || !Number.isFinite(Number(primary.usedPercent))) {
    return null;
  }

  const resetCredits = result?.rateLimitResetCredits;
  const credits = Array.isArray(resetCredits?.credits)
    ? resetCredits.credits
        .filter((card) => card?.status === 'available')
        .map((card) => ({
          expiresAt: numberOrZero(card.expiresAt),
          title: typeof card.title === 'string' ? card.title : ''
        }))
    : [];

  return {
    usedPercent: clamp(Number(primary.usedPercent), 0, 100),
    resetsAt: numberOrZero(primary.resetsAt),
    resetCount: Math.max(0, Math.trunc(numberOrZero(resetCredits?.availableCount))),
    resetCards: credits
  };
}

export function quotaView(snapshot, locale = 'zh-CN', now = new Date()) {
  const remaining = Math.round(clamp(100 - snapshot.usedPercent, 0, 100));
  const isChinese = locale.toLowerCase().startsWith('zh');
  const pieces = [
    isChinese ? `剩余 ${remaining}%` : `${remaining}% left`,
    formatMoment(snapshot.resetsAt, isChinese ? '重置' : 'reset', locale, now)
  ];

  if (snapshot.resetCount > 0) {
    pieces.push(`Reset ×${snapshot.resetCount}`);
    snapshot.resetCards.forEach((card, index) => {
      const label = snapshot.resetCards.length > 1 ? `#${index + 1} ` : '';
      pieces.push(`${label}${formatMoment(card.expiresAt, isChinese ? '到期' : 'expires', locale, now)}`);
    });
    const unknown = snapshot.resetCount - snapshot.resetCards.length;
    if (unknown > 0 && snapshot.resetCards.length > 0) {
      pieces.push(isChinese ? `另 ${unknown} 张到期时间未知` : `${unknown} more with unknown expiry`);
    }
  }

  return {
    remaining,
    text: pieces.join('  ·  '),
    accent: remaining > 50 ? '#4dd18d' : remaining > 20 ? '#f6be48' : '#ff6767'
  };
}

export function formatMoment(unixSeconds, suffix, locale = 'zh-CN', now = new Date()) {
  if (!unixSeconds) {
    return locale.toLowerCase().startsWith('zh') ? `${suffix}时间未知` : `${suffix} unknown`;
  }

  const value = new Date(unixSeconds * 1000);
  const today = startOfDay(now);
  const target = startOfDay(value);
  const dayDifference = Math.round((target.getTime() - today.getTime()) / 86400000);
  const time = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', hour12: false}).format(
    value
  );
  let day;
  if (locale.toLowerCase().startsWith('zh')) {
    day =
      dayDifference === 0
        ? '今天'
        : dayDifference === 1
          ? '明天'
          : `${value.getMonth() + 1}月${value.getDate()}日`;
    return `${day} ${time} ${suffix}`;
  }
  day =
    dayDifference === 0
      ? 'Today'
      : dayDifference === 1
        ? 'Tomorrow'
        : new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric'}).format(value);
  return `${day} ${time} ${suffix}`;
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
