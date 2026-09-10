export function readText(value: unknown, field = "content", max = 12000): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${field} is too long`);
  return text;
}

export function errorResponse(error: unknown) {
  const detail = error instanceof Error ? error.message : "Unexpected server error";
  console.error("API request failed", error);
  if (/^Authentication required$|auth session missing|invalid jwt|jwt malformed|session expired|no authorization/i.test(detail)) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (/^Admin access required$/i.test(detail)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  if (/^Too many requests$/i.test(detail)) {
    return Response.json({ error: detail }, { status: 429, headers: { "Retry-After": "60" } });
  }
  if (/not found|already reviewed/i.test(detail)) {
    return Response.json({ error: "Resource not found" }, { status: 404 });
  }
  if (/required$|too long|^Invalid /i.test(detail)) {
    return Response.json({ error: detail }, { status: 400 });
  }
  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}
