export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}
