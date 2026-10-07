# Jadwal sinkron Notion

Target: setiap hari **02:00 WIB** (UTC+7) = **19:00 UTC** hari sebelumnya, cron `0 19 * * *`.

Status: scheduler belum dipasang karena belum ada deployment. Sampai ada, sync dijalankan manual.

## Mekanisme

```text
Scheduler (02:00 WIB) -> POST /api/cron/notion-sync (header x-cron-secret)
  -> lib/notion-sync.ts: baca Notion -> upsert knowledge_documents (synced_at) -> hapus stale -> audit_events
```

- Endpoint: `app/api/cron/notion-sync/route.ts`. Tanpa/salah secret -> 401.
- `CRON_SECRET` harus sama di environment app dan scheduler.
- Biarkan `CSCOPILOT_SYNC_INTERVAL_MINUTES` kosong. Timer itu interval sejak server hidup (bukan jam tetap) dan otomatis nonaktif jika `CRON_SECRET` terisi.
- Scheduler harus memanggil URL production, bukan `localhost`.

## Manual sekarang

```powershell
npx tsx --env-file=.env.local scripts/run-notion-sync.ts
```

## Contoh setelah deploy

Windows Task Scheduler (mesin harus hidup dan tidak sleep pukul 02:00; trigger Daily 02:00, waktu lokal WIB):

```powershell
Invoke-RestMethod -Method Post -Uri "https://<app-url>/api/cron/notion-sync" -Headers @{ "x-cron-secret" = $env:CRON_SECRET }
```

GitHub Actions (waktu UTC):

```yaml
on:
  schedule:
    - cron: "0 19 * * *"
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" "${{ secrets.APP_URL }}/api/cron/notion-sync"
```

Vercel Cron memanggil `GET` dengan `Authorization: Bearer`, jadi endpoint perlu adapter kecil sebelum dipakai.

## Verifikasi setelah dipasang

Jalankan sekali manual, lalu cek response `{ "action": "completed", "synced": N }`, `knowledge_documents.synced_at`, dan baris `sync_scheduled_*_rows` di `audit_events`.
