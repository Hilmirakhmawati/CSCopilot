export function readText(value: unknown, field = "content", max = 12000): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} is too long`);
  return text;
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = /auth|session|credential/i.test(message) ? 401 : /required|too long|invalid/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}
