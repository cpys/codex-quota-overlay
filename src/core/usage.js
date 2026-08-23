const SUMMARY_FIELDS = [
  'lifetimeTokens',
  'peakDailyTokens',
  'longestRunningTurnSec',
  'currentStreakDays',
  'longestStreakDays'
];

export function parseUsageResult(result) {
  const rawSummary = result?.summary;
  const summary = {};
  for (const field of SUMMARY_FIELDS) summary[field] = optionalCount(rawSummary?.[field]);

  const dailyUsageBuckets = Array.isArray(result?.dailyUsageBuckets)
    ? result.dailyUsageBuckets
        .map((bucket) => ({
          startDate: validDate(bucket?.startDate) ? bucket.startDate : '',
          tokens: optionalCount(bucket?.tokens)
        }))
        .filter((bucket) => bucket.startDate && bucket.tokens !== null)
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
        .slice(-90)
    : [];

  if (Object.values(summary).every((value) => value === null) && dailyUsageBuckets.length === 0) {
    return null;
  }
  return {summary, dailyUsageBuckets};
}

function optionalCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed));
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
