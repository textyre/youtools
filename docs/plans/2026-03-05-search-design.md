# Search Feature Design

**Date:** 2026-03-05

## Overview

Add a `search` command to youtools that searches YouTube videos by query, optionally scoped to a channel. Results are displayed as a table with statistics (views, likes, comments), analogous to `popular-videos`.

## Command Interface

```
youtools search <query> [options]

Arguments:
  query                    Search query string

Options:
  --channel <ch>           Limit search to a channel (ID, @handle, or URL)
  -n, --limit <n>          Number of results to return (default: 25)
  --sort <keys>            Comma-separated sort keys: views,likes,comments (default: views)
  --order <order>          asc | desc (default: desc)
  --ascii                  Force ASCII table
  --wide                   Show description column
```

## Module Structure

```
src/modules/search/
  index.ts      — Commander command definition
  service.ts    — Business logic: YouTube search.list + videos.list for stats
  types.ts      — SearchRecord type (same shape as VideoRecord)
  ui.ts         — Table rendering (reuses renderTable from popular-videos)
```

## API Calls

1. **`search.list`** — find video IDs matching the query
   - `part: ['snippet']`
   - `q: query`
   - `type: ['video']`
   - `channelId` (optional, when --channel is provided)
   - `maxResults: limit` (up to 50 per page)

2. **`videos.list`** — fetch statistics for found video IDs
   - `part: ['snippet', 'statistics']`
   - Same batch logic as `popular-videos`

3. **`channels.list`** — resolve channel handle/URL to ID (reuse `resolveChannelId` from popular-videos)

## MCP Tool

Add `search_videos` tool to `mcp.ts`:

```typescript
{
  name: 'search_videos',
  description: 'Search YouTube videos by query, optionally scoped to a channel',
  inputSchema: {
    query: string,       // required
    channelId?: string,  // optional channel filter
    limit?: number,      // default 25
  }
}
```

Returns array of video records with title, url, viewCount, likeCount, commentCount, publishedAt.

## Reuse from popular-videos

- `resolveChannelId` — channel resolution logic
- `buildYouTubeClient` — auth/API key setup
- `VideoRecord` type (or alias as `SearchRecord`)
- `renderTable` / `ui.ts` — table rendering
- `SortKey`, `SortOrder` types
- `compositeSort` — client-side re-sorting of results
