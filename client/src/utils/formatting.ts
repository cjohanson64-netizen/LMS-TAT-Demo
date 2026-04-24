export function formatTatStateLabel(value?: string | null): string {
  if (!value || value.trim().toLowerCase() === "null") {
    return "--";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTatValue(
  value?: string | number | boolean | null
): string {
  if (value === null || value === undefined) {
    return "--";
  }

  if (typeof value === "string" && value.trim().toLowerCase() === "null") {
    return "--";
  }

  return String(value);
}
