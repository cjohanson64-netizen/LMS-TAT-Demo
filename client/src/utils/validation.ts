export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isNonNegativeNumberString(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return false;
  }

  const parsed = Number(trimmed);
  return !Number.isNaN(parsed) && parsed >= 0;
}