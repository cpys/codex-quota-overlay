const MINIMUM_RATE_SPAN_MS = 2 * 60 * 1000;

export function calculateQuotaInsights(samples, snapshot, now = Date.now()) {
  const remaining = clamp(100 - Number(snapshot?.usedPercent || 0), 0, 100);
  const resetsAt = finite(snapshot?.resetsAt, 0);
  const limitId = cleanLimitId(snapshot?.limitId);
  const points = normalizeSamples(samples)
    .filter((sample) => (!resetsAt || sample.resetsAt === resetsAt) && sample.limitId === limitId)
    .filter((sample) => sample.at <= now + 5 * 60 * 1000)
    .sort((left, right) => left.at - right.at);

  const current = {
    at: now,
    usedPercent: clamp(Number(snapshot?.usedPercent || 0), 0, 100),
    resetsAt,
    limitId
  };
  if (!points.length || points.at(-1).at < now - 1000) points.push(current);
  const segment = samplesSinceLastDrop(points);
  const first = segment[0];
  const last = segment.at(-1);
  const spanMs = first && last ? last.at - first.at : 0;
  const usedDelta = first && last ? Math.max(0, last.usedPercent - first.usedPercent) : 0;
  const rawRate = spanMs >= MINIMUM_RATE_SPAN_MS ? usedDelta / (spanMs / 3_600_000) : null;
  const burnRatePerHour =
    rawRate !== null && rawRate >= 0.05 ? round(rawRate, 2) : rawRate === null ? null : 0;
  const hoursToReset = resetsAt ? Math.max(0, resetsAt * 1000 - now) / 3_600_000 : null;
  const safeRatePerHour = hoursToReset && hoursToReset > 0 ? round(remaining / hoursToReset, 2) : null;
  const paceRatio =
    burnRatePerHour !== null && safeRatePerHour && safeRatePerHour > 0
      ? round(burnRatePerHour / safeRatePerHour, 2)
      : null;
  const exhaustsAt =
    burnRatePerHour && burnRatePerHour > 0
      ? Math.round(now + (remaining / burnRatePerHour) * 3_600_000)
      : null;
  const confidence = confidenceFor(segment.length, spanMs);
  const status = statusFor({remaining, burnRatePerHour, exhaustsAt, resetsAt, paceRatio});

  return {
    burnRatePerHour,
    confidence,
    exhaustsAt,
    hoursToReset: hoursToReset === null ? null : round(hoursToReset, 2),
    paceRatio,
    remaining: round(remaining, 1),
    safeRatePerHour,
    sampleCount: segment.length,
    spanMinutes: Math.round(spanMs / 60000),
    status
  };
}

function samplesSinceLastDrop(samples) {
  let start = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].usedPercent < samples[index - 1].usedPercent - 0.5) start = index;
  }
  return samples.slice(start);
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples)) return [];
  const result = [];
  for (const sample of samples) {
    const at = finite(sample?.at, 0);
    const usedPercent = finite(sample?.usedPercent, Number.NaN);
    if (!at || !Number.isFinite(usedPercent)) continue;
    result.push({
      at,
      usedPercent: clamp(usedPercent, 0, 100),
      resetsAt: finite(sample?.resetsAt, 0),
      limitId: cleanLimitId(sample?.limitId)
    });
  }
  return result;
}

function confidenceFor(sampleCount, spanMs) {
  if (sampleCount >= 6 && spanMs >= 30 * 60 * 1000) return 'high';
  if (sampleCount >= 3 && spanMs >= 10 * 60 * 1000) return 'medium';
  if (sampleCount >= 2 && spanMs >= MINIMUM_RATE_SPAN_MS) return 'low';
  return 'none';
}

function statusFor({remaining, burnRatePerHour, exhaustsAt, resetsAt, paceRatio}) {
  if (remaining <= 0) return 'exhausted';
  if (burnRatePerHour === null) return 'learning';
  if (burnRatePerHour === 0) return 'steady';
  if (resetsAt && exhaustsAt && exhaustsAt < resetsAt * 1000 - 5 * 60 * 1000 && paceRatio > 1.05) {
    return 'risk';
  }
  if (paceRatio !== null && paceRatio >= 0.85) return 'tight';
  return 'on-track';
}

function cleanLimitId(value) {
  return typeof value === 'string' && value ? value.slice(0, 80) : 'codex';
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
