# Design: popular-videos module

**Date:** 2026-02-23
**Status:** Approved

## Overview

Add a new `popular-videos` CLI module to `youtools` that fetches the top N most popular videos of a YouTube channel and renders them in a terminal table. Popularity is defined by views, likes, and/or comments, with support for composite (multi-key) sorting.

## CLI Interface

```
youtools popular-videos <channel> [options]

Arguments:
  channel              Channel ID (UCxxx), @handle, or full youtube.com URL

Options:
  -n, --limit <n>      Number of videos to return            (default: 50)
  --sort <modes>       Comma-separated sort keys:            (default: views)
                       views | likes | comments
                       First key is primary; subsequent keys are tiebreakers.
  --order <order>      asc | desc                            (default: desc)
  --max-scan <n>       Max videos to scan (0 = all)          (default: 0)
  --cache-ttl <s>      Cache TTL in seconds                  (default: 3600)
  --no-cache           Bypass cache and force fresh fetch
  --ascii              Force ASCII table
  --wide               Wide output (show video description snippet)
```

### Examples

```bash
youtools popular-videos UCxxxxxx --limit 20 --sort likes
youtools popular-videos @mkbhd --limit 50 --sort views,likes
youtools popular-videos https://youtube.com/channel/UCxxxx --sort comments
youtools popular-videos @channel --no-cache --max-scan 200
```

## Architecture

### New files

```
src/modules/popular-videos/
  index.ts    ← Commander command definition
  service.ts  ← business logic: channel resolution, fetch, cache, sort
  cache.ts    ← disk cache (~/.cache/youtools/<channelId>-videos.json)
  ui.ts       ← table rendering
```

### Modified files

- `src/cli.ts` — register `popularVideosCommand`

## Data Flow

```
<channel> argument
    │
    ▼
resolveChannelId()
  - UCxxx → use as-is
  - @handle → channels.list { forHandle }
  - youtube.com/channel/UCxxx → extract ID
  - youtube.com/@handle → extract handle → channels.list
  - youtube.com/user/legacy → channels.list { forUsername }
    │
    ▼
checkCache(channelId, cacheTtl)
  - hit: return cached video list
  - miss: continue
    │
    ▼
channels.list({ id: channelId, part: ['contentDetails'] })
  → uploadsPlaylistId
    │
    ▼
playlistItems.list (paginated, maxResults=50 per page)
  → collect videoIds[] (stop when maxScan reached or no nextPageToken)
    │
    ▼
videos.list (batches of 50, part: ['snippet','statistics'])
  → VideoRecord[]
    │
    ▼
saveCache(channelId, VideoRecord[])
    │
    ▼
compositeSort(videos, sortKeys, order) → top N
    │
    ▼
renderTable(topN, opts)
```

## Data Model

```typescript
interface VideoRecord {
  id: string
  title: string
  publishedAt: string        // ISO 8601
  description: string        // first 200 chars for --wide
  viewCount: number
  likeCount: number
  commentCount: number
}
```

## Channel Resolution

| Input format                          | Resolution method                          |
|---------------------------------------|--------------------------------------------|
| `UCxxxxxxxxxxxxxxxx`                  | Use as channel ID directly                 |
| `@handle`                             | `channels.list({ forHandle: 'handle' })`   |
| `https://youtube.com/channel/UCxxx`   | Extract ID from URL path                   |
| `https://youtube.com/@handle`         | Extract handle → `channels.list`           |
| `https://youtube.com/user/username`   | `channels.list({ forUsername: 'username'})`|

## Sorting

`--sort views,likes,comments` produces a composite comparator:

```
sort by views DESC → if equal, sort by likes DESC → if equal, sort by comments DESC
```

## Caching

- Cache file: `~/.cache/youtools/<channelId>-videos.json`
- Format: `{ fetchedAt: string (ISO), videos: VideoRecord[] }`
- A cached result is considered fresh if `Date.now() - fetchedAt < cacheTtl * 1000`
- `--no-cache` bypasses the freshness check and always refetches
- Cache directory is created with mode `0o700`; cache files with mode `0o600`

## Output Table

Default columns: `#` | `Title` | `Views` | `Likes` | `Comments` | `Published` | `ID`

`--wide` adds: `Description` (truncated to 80 chars)

## Authentication

Same as `popular-comments`:
- If `YT_API_KEY` env var is set → use API key
- Otherwise → OAuth flow via `src/lib/googleAuth.ts`

## Error Handling

- Channel not found → friendly error message + exit 1
- API quota exceeded → display error message; partial cache results returned if available
- Network errors → bubble up with context
- Empty uploads playlist → warn and exit 0 with empty table

## Out of Scope

- Filtering by date range (future enhancement)
- Export to CSV/JSON (future enhancement)
- Combining with popular-comments to rank videos by comment quality (future)
