import { syncNotionKnowledge } from "../lib/notion-sync";

// Manual one-off sync. Run with: npx tsx --env-file=.env.local scripts/run-notion-sync.ts
async function main() {
  const pageId = process.env.NOTION_ROOT_PAGE_ID?.trim();
  if (!pageId) throw new Error("NOTION_ROOT_PAGE_ID is not configured");
  const { synced, results } = await syncNotionKnowledge({ pageId, actorId: null, actionPrefix: "sync_manual_script" });
  console.log(`Synced ${synced} rows`);
  for (const row of results) console.log(`- ${row.action}: ${row.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
