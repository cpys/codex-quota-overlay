export class QuotaAlertTracker {
  constructor() {
    this.cycle = '';
    this.sent = new Set();
  }

  evaluate(snapshot, insights, alerts = {}) {
    if (!alerts.enabled || !snapshot) return [];
    const cycle = `${snapshot.limitId || 'codex'}:${snapshot.resetsAt || 0}`;
    if (cycle !== this.cycle) {
      this.cycle = cycle;
      this.sent.clear();
    }

    const remaining = Math.round(clamp(100 - Number(snapshot.usedPercent || 0), 0, 100));
    const threshold = [10, 20, 30].includes(Number(alerts.threshold)) ? Number(alerts.threshold) : 20;
    const thresholdKey = `threshold:${threshold}`;
    if (remaining <= threshold && !this.sent.has(thresholdKey)) {
      this.sent.add(thresholdKey);
      return [{kind: 'threshold', remaining, threshold}];
    }

    const riskKey = 'pace-risk';
    if (
      alerts.paceRisk !== false &&
      insights?.status === 'risk' &&
      insights.confidence !== 'none' &&
      !this.sent.has(riskKey)
    ) {
      this.sent.add(riskKey);
      return [
        {
          kind: 'pace-risk',
          remaining,
          exhaustsAt: insights.exhaustsAt,
          resetsAt: snapshot.resetsAt
        }
      ];
    }
    return [];
  }

  reset() {
    this.cycle = '';
    this.sent.clear();
  }
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
