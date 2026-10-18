function fitBoundsToWorkArea(bounds, workArea, { minWidth = 320, minHeight = 360 } = {}) {
  const safeBounds = bounds || {};
  const safeWorkArea = workArea || {};
  const availableWidth = Math.max(minWidth, Number(safeWorkArea.width) || minWidth);
  const availableHeight = Math.max(minHeight, Number(safeWorkArea.height) || minHeight);
  const width = Math.min(Math.max(minWidth, Number(safeBounds.width) || minWidth), availableWidth);
  const height = Math.min(Math.max(minHeight, Number(safeBounds.height) || minHeight), availableHeight);
  const workAreaX = Number(safeWorkArea.x) || 0;
  const workAreaY = Number(safeWorkArea.y) || 0;
  const currentX = Number(safeBounds.x) || 0;
  const currentY = Number(safeBounds.y) || 0;
  const x = Math.min(Math.max(currentX, workAreaX), workAreaX + Math.max(0, availableWidth - width));
  const y = Math.min(Math.max(currentY, workAreaY), workAreaY + Math.max(0, availableHeight - height));

  return { x, y, width, height };
}

module.exports = { fitBoundsToWorkArea };
