const SIZE_UNITS = new Map<string, number>([
  ['b', 1],
  ['kb', 1024],
  ['mb', 1024 * 1024],
  ['gb', 1024 * 1024 * 1024],
]);

export function parseSizeToBytes(value: string | number | undefined, fallbackBytes: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== 'string') {
    return fallbackBytes;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallbackBytes;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);

  if (!match) {
    return fallbackBytes;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2];
  const multiplier = SIZE_UNITS.get(unit);

  if (!Number.isFinite(amount) || !multiplier) {
    return fallbackBytes;
  }

  return Math.floor(amount * multiplier);
}