const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const OVERLAY_MODES = new Set(['compact', 'balanced', 'insight']);

export function parseQuotaResult(result) {
  const legacyBucket = parseBucket(result?.rateLimits, result?.rateLimits?.limitId || 'codex');
  const keyedBuckets = parseKeyedBuckets(result?.rateLimitsByLimitId);
  const selected = legacyBucket ?? keyedBuckets[0];
  if (!selected?.primary) return null;

  const buckets = [];
  if (legacyBucket) buckets.push(legacyBucket);
  for (const bucket of keyedBuckets) {
    if (!buckets.some((candidate) => candidate.limitId === bucket.limitId)) buckets.push(bucket);
  }

  const resetCredits = result?.rateLimitResetCredits;
  const credits = Array.isArray(resetCredits?.credits)
    ? resetCredits.credits
        .filter((card) => card?.status === 'available')
        .map((card) => ({
          expiresAt: numberOrZero(card.expiresAt),
          title: typeof card.title === 'string' ? card.title.slice(0, 80) : ''
        }))
    : [];

  return {
    buckets,
    limitId: selected.limitId,
    limitName: selected.limitName,
    rateLimitReachedType: selected.rateLimitReachedType,
    usedPercent: selected.primary.usedPercent,
    resetsAt: selected.primary.resetsAt,
    windowDurationMins: selected.primary.windowDurationMins,
    resetCount: Math.max(0, Math.trunc(numberOrZero(resetCredits?.availableCount))),
    resetCards: credits
  };
}

export function quotaView(snapshot, locale = 'zh-CN', now = new Date(), options = {}) {
  const remaining = Math.round(clamp(100 - snapshot.usedPercent, 0, 100));
  const isChinese = locale.toLowerCase().startsWith('zh');
  const mode = OVERLAY_MODES.has(options.mode) ? options.mode : 'balanced';
  const insights = options.insights;
  const pieces = [];

  if (mode === 'compact') {
    pieces.push(isChinese ? `余 ${remaining}%` : `${remaining}% left`);
    pieces.push(formatCountdown(snapshot.resetsAt, locale, now));
    if (snapshot.resetCount > 0) pieces.push(`Reset ×${snapshot.resetCount}`);
  } else {
    pieces.push(isChinese ? `剩余 ${remaining}%` : `${remaining}% left`);
    pieces.push(formatMoment(snapshot.resetsAt, isChinese ? '重置' : 'reset', locale, now));

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
  }

  if (mode === 'insight' && Number.isFinite(insights?.burnRatePerHour)) {
    pieces.push(
      isChinese
        ? `消耗 ${formatRate(insights.burnRatePerHour)}%/时`
        : `Burn ${formatRate(insights.burnRatePerHour)}%/h`
    );
    if (insights.status === 'risk' && insights.exhaustsAt) {
      pieces.push(
        isChinese
          ? `预计 ${formatClock(insights.exhaustsAt, locale)} 用尽`
          : `Empty ~${formatClock(insights.exhaustsAt, locale)}`
      );
    } else if (insights.status === 'on-track' || insights.status === 'steady') {
      pieces.push(isChinese ? '节奏安全' : 'On track');
    }
  }

  const riskAccent = insights?.status === 'risk' ? '#ff8a65' : null;
  if (options.stale) {
    const time = formatClock(options.updatedAt, locale);
    pieces.push(isChinese ? `更新失败 · 上次 ${time}` : `Update failed · last ${time}`);
  }
  return {
    remaining,
    text: pieces.join('  ·  '),
    accent: options.stale
      ? '#f6be48'
      : (riskAccent ?? (remaining > 50 ? '#4dd18d' : remaining > 20 ? '#f6be48' : '#ff6767')),
    mode,
    status: options.stale ? 'stale' : (insights?.status ?? (remaining > 20 ? 'healthy' : 'low'))
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
  const time = formatClock(value.getTime(), locale);
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

export function formatCountdown(unixSeconds, locale = 'zh-CN', now = new Date()) {
  const isChinese = locale.toLowerCase().startsWith('zh');
  if (!unixSeconds) return isChinese ? '重置未知' : 'Reset unknown';
  const totalMinutes = Math.max(0, Math.ceil((unixSeconds * 1000 - now.getTime()) / 60000));
  if (totalMinutes === 0) return isChinese ? '即将重置' : 'Reset due';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return isChinese ? `${days}天${hours}小时后重置` : `Reset in ${days}d ${hours}h`;
  if (hours > 0) return isChinese ? `${hours}小时${minutes}分后重置` : `Reset in ${hours}h ${minutes}m`;
  return isChinese ? `${minutes}分后重置` : `Reset in ${minutes}m`;
}

function parseKeyedBuckets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([limitId, bucket]) => parseBucket(bucket, limitId))
    .filter(Boolean);
}

function parseBucket(value, fallbackId) {
  if (!value || typeof value !== 'object') return null;
  const primary = parseWindow(value.primary, 'primary');
  const secondary = parseWindow(value.secondary, 'secondary');
  if (!primary && !secondary) return null;
  return {
    limitId: cleanLabel(value.limitId || fallbackId, 'codex'),
    limitName: cleanLabel(value.limitName, ''),
    rateLimitReachedType: cleanLabel(value.rateLimitReachedType, ''),
    primary,
    secondary,
    windows: [primary, secondary].filter(Boolean)
  };
}

function parseWindow(value, kind) {
  if (!value || !Number.isFinite(Number(value.usedPercent))) return null;
  return {
    kind,
    usedPercent: clamp(Number(value.usedPercent), 0, 100),
    resetsAt: numberOrZero(value.resetsAt),
    windowDurationMins: Math.max(0, Math.trunc(numberOrZero(value.windowDurationMins)))
  };
}

function cleanLabel(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatClock(milliseconds, locale) {
  return new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', hour12: false}).format(
    new Date(milliseconds)
  );
}

function formatRate(value) {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
