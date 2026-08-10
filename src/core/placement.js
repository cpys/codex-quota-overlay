export const DEFAULT_PLACEMENT = Object.freeze({
  xRatio: 0.4,
  contentLeftRatio: 0.205,
  contentGap: 170,
  rightPadding: 24,
  yRatio: 0.067,
  yMinimum: 48,
  yMaximum: 96,
  yTitleAdjustment: 14,
  referenceHeight: 40
});

export function placeOverlay(owner, overlay, adjustment = {}, tuning = DEFAULT_PLACEMENT) {
  const xAdjustment = finite(adjustment.x, 0);
  const yAdjustment = finite(adjustment.y, 0);
  let x = owner.x + Math.round(owner.width * tuning.xRatio);
  const heightAdjustment = Math.max(0, overlay.height - tuning.referenceHeight) / 2;
  const yOffset =
    clamp(Math.round(owner.height * tuning.yRatio), tuning.yMinimum, tuning.yMaximum) -
    tuning.yTitleAdjustment -
    heightAdjustment;
  let y = owner.y + Math.round(yOffset);

  const contentLeft = owner.x + Math.round(owner.width * tuning.contentLeftRatio);
  x = Math.max(x, contentLeft + tuning.contentGap);
  const rightmost = owner.x + owner.width - tuning.rightPadding - overlay.width;
  x = Math.min(x, rightmost);
  x = Math.max(owner.x, x);

  return {x: Math.round(x + xAdjustment), y: Math.round(y + yAdjustment)};
}

export function physicalToDipBounds(bounds, platform, scaleFactor = 1) {
  if (platform === 'darwin' || scaleFactor === 1) {
    return {...bounds};
  }
  return {
    x: Math.round(bounds.x / scaleFactor),
    y: Math.round(bounds.y / scaleFactor),
    width: Math.round(bounds.width / scaleFactor),
    height: Math.round(bounds.height / scaleFactor)
  };
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
