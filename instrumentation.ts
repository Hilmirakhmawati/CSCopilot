// Next.js calls register() once, at server boot (App Router, stable since
// Next 15 — no config flag needed). Fail fast on missing required config
// instead of letting the first request hit an obscure downstream error.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}. Set them in .env.local.`);
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim() && process.env.CSCOPILOT_NO_AI !== "1") {
    console.warn("ANTHROPIC_API_KEY is not set — AI-generated answers will be unavailable until it is configured.");
  }
  if (!process.env.NOTION_TOKEN?.trim() || !process.env.NOTION_ROOT_PAGE_ID?.trim()) {
    console.warn("NOTION_TOKEN/NOTION_ROOT_PAGE_ID is not fully set — Notion knowledge sync will be unavailable until configured.");
  }

  // Opt-in scheduled Notion sync: 0/off by default; minimum 5 minutes.
  const intervalMinutes = Number(process.env.CSCOPILOT_SYNC_INTERVAL_MINUTES);
  if (!intervalMinutes || intervalMinutes < 5) {
    if (intervalMinutes) console.warn("CSCOPILOT_SYNC_INTERVAL_MINUTES below 5 — scheduled Notion sync disabled.");
    return;
  }
  let syncRunning = false;
  const timer = setInterval(() => {
    if (syncRunning) return;
    syncRunning = true;
    import("./lib/notion-sync")
      .then(({ syncNotionKnowledge }) => syncNotionKnowledge({ pageId: process.env.NOTION_ROOT_PAGE_ID!.trim(), actorId: null, actionPrefix: "sync_scheduled" }))
      .then(({ synced }) => console.log(`Scheduled Notion sync completed: ${synced} rows`))
      .catch((error) => console.error("Scheduled Notion sync failed", error))
      .finally(() => { syncRunning = false; });
  }, intervalMinutes * 60_000);
  timer.unref?.();
  console.log(`Scheduled Notion sync enabled: every ${intervalMinutes} minute(s).`);
}
