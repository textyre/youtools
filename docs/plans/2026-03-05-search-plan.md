# Search Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `search` CLI command and `search_videos` MCP tool that searches YouTube videos by query, optionally scoped to a channel.

**Architecture:** New module `src/modules/search/` with service, types, and index. The service calls YouTube `search.list` to get video IDs, then `videos.list` for stats — reusing auth, sort, and UI logic from `popular-videos`.

**Tech Stack:** TypeScript, googleapis, commander, cli-table3, zod (MCP), jest

---

### Task 1: Create module types

**Files:**
- Create: `src/modules/search/types.ts`

Types are identical to `popular-videos` — we re-export from there to avoid duplication.

**Step 1: Create the types file**

```typescript
// src/modules/search/types.ts
export type { VideoRecord, SortKey, SortOrder } from '../popular-videos/types'

export interface SearchCfg {
  query: string
  channel?: string
  limit: number
  sort: SortKey[]
  order: SortOrder
  ascii: boolean
  wide: boolean
}
```

**Step 2: Verify it compiles**

```bash
cd /Users/umudrakov/Documents/youtools
pnpm build 2>&1 | head -20
```

Expected: No errors (or only pre-existing errors).

**Step 3: Commit**

```bash
git add src/modules/search/types.ts
git commit -m "feat(search): add SearchCfg type"
```

---

### Task 2: Write service tests

**Files:**
- Create: `src/modules/search/service.test.ts`

We mock the YouTube client so tests don't make real API calls.

**Step 1: Create test file**

```typescript
// src/modules/search/service.test.ts
import { buildSearchResults } from './service'
import { VideoRecord } from './types'

describe('buildSearchResults', () => {
  it('maps search items + stats to VideoRecord[]', () => {
    const searchItems = [
      { id: { videoId: 'vid1' } },
      { id: { videoId: 'vid2' } },
    ]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'Video One', publishedAt: '2024-01-01T00:00:00Z', description: 'desc one' },
        statistics: { viewCount: '1000', likeCount: '50', commentCount: '10' },
      },
      {
        id: 'vid2',
        snippet: { title: 'Video Two', publishedAt: '2024-06-01T00:00:00Z', description: 'desc two' },
        statistics: { viewCount: '2000', likeCount: '100', commentCount: '20' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual<VideoRecord>({
      id: 'vid1',
      title: 'Video One',
      publishedAt: '2024-01-01T00:00:00Z',
      description: 'desc one',
      viewCount: 1000,
      likeCount: 50,
      commentCount: 10,
    })
    expect(result[1].id).toBe('vid2')
    expect(result[1].viewCount).toBe(2000)
  })

  it('handles missing statistics gracefully', () => {
    const searchItems = [{ id: { videoId: 'vid1' } }]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'No Stats', publishedAt: '2024-01-01T00:00:00Z', description: '' },
        statistics: {},
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)

    expect(result[0].viewCount).toBe(0)
    expect(result[0].likeCount).toBe(0)
    expect(result[0].commentCount).toBe(0)
  })

  it('skips search items with no videoId', () => {
    const searchItems = [
      { id: { videoId: 'vid1' } },
      { id: {} }, // no videoId
    ]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'Good', publishedAt: '2024-01-01T00:00:00Z', description: '' },
        statistics: { viewCount: '500', likeCount: '10', commentCount: '2' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('vid1')
  })

  it('skips stats items with no id', () => {
    const searchItems = [{ id: { videoId: 'vid1' } }]
    const statsItems = [
      {
        // no id field
        snippet: { title: 'Orphan', publishedAt: '', description: '' },
        statistics: { viewCount: '100', likeCount: '5', commentCount: '1' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)
    // vid1 has no matching stats entry, so it gets zero stats
    expect(result[0].viewCount).toBe(0)
  })
})
```

**Step 2: Run tests — expect FAIL**

```bash
pnpm test src/modules/search/service.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module './service'`

**Step 3: Commit tests**

```bash
git add src/modules/search/service.test.ts
git commit -m "test(search): add buildSearchResults unit tests"
```

---

### Task 3: Implement the service

**Files:**
- Create: `src/modules/search/service.ts`

**Step 1: Create service file**

```typescript
// src/modules/search/service.ts
import { google, youtube_v3 } from 'googleapis'
import { ensureAuthClient } from '../../lib/googleAuth'
import { VideoRecord, SearchCfg } from './types'
import { parseChannelInput } from '../popular-videos/channel'
import { compositeSort } from '../popular-videos/sort'
import { renderTable } from '../popular-videos/ui'

async function buildYouTubeClient(): Promise<youtube_v3.Youtube> {
  const apiKey = process.env.YT_API_KEY
  if (apiKey) return google.youtube({ version: 'v3', auth: apiKey })
  const auth = await ensureAuthClient()
  return google.youtube({ version: 'v3', auth })
}

async function resolveChannelId(youtube: youtube_v3.Youtube, raw: string): Promise<string> {
  const input = parseChannelInput(raw)
  if (input.type === 'id') return input.value

  const params: Record<string, string> =
    input.type === 'handle'
      ? { forHandle: input.value }
      : { forUsername: input.value }

  const res = await youtube.channels.list({ part: ['id'], ...params })
  const id = res.data.items?.[0]?.id
  if (!id) throw new Error(`Channel not found: ${raw}`)
  return id
}

export function buildSearchResults(
  searchItems: youtube_v3.Schema$SearchResult[],
  statsItems: youtube_v3.Schema$Video[],
): VideoRecord[] {
  const statsMap = new Map<string, youtube_v3.Schema$Video>()
  for (const item of statsItems) {
    if (item.id) statsMap.set(item.id, item)
  }

  const records: VideoRecord[] = []
  for (const item of searchItems) {
    const videoId = item.id?.videoId
    if (!videoId) continue
    const stat = statsMap.get(videoId)
    records.push({
      id: videoId,
      title: stat?.snippet?.title ?? '',
      publishedAt: stat?.snippet?.publishedAt ?? '',
      description: (stat?.snippet?.description ?? '').slice(0, 200),
      viewCount: Number(stat?.statistics?.viewCount ?? 0),
      likeCount: Number(stat?.statistics?.likeCount ?? 0),
      commentCount: Number(stat?.statistics?.commentCount ?? 0),
    })
  }
  return records
}

async function fetchStatsBatch(
  youtube: youtube_v3.Youtube,
  videoIds: string[],
): Promise<youtube_v3.Schema$Video[]> {
  const items: youtube_v3.Schema$Video[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: batch,
    })
    items.push(...(res.data.items ?? []))
  }
  return items
}

export async function runSearch(cfg: SearchCfg): Promise<void> {
  const youtube = await buildYouTubeClient()

  const searchParams: youtube_v3.Params$Resource$Search$List = {
    part: ['snippet'],
    q: cfg.query,
    type: ['video'],
    maxResults: Math.min(cfg.limit, 50),
  }

  if (cfg.channel) {
    searchParams.channelId = await resolveChannelId(youtube, cfg.channel)
  }

  const searchRes = await youtube.search.list(searchParams)
  const searchItems = searchRes.data.items ?? []

  if (searchItems.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No results found.')
    return
  }

  const videoIds = searchItems.map((i) => i.id?.videoId).filter((id): id is string => !!id)
  const statsItems = await fetchStatsBatch(youtube, videoIds)
  const videos = buildSearchResults(searchItems, statsItems)
  const sorted = compositeSort(videos, cfg.sort, cfg.order).slice(0, cfg.limit)
  await renderTable(sorted, cfg)
}
```

**Step 2: Run tests — expect PASS**

```bash
pnpm test src/modules/search/service.test.ts 2>&1 | tail -20
```

Expected: All 4 tests pass.

**Step 3: Commit**

```bash
git add src/modules/search/service.ts
git commit -m "feat(search): implement search service with buildSearchResults"
```

---

### Task 4: Create the CLI command

**Files:**
- Create: `src/modules/search/index.ts`
- Modify: `src/cli.ts`

**Step 1: Create the command file**

```typescript
// src/modules/search/index.ts
import { Command } from 'commander'
import { runSearch } from './service'
import { SortKey, SortOrder } from './types'

function parseSortKeys(value: string): SortKey[] {
  const allowed: SortKey[] = ['views', 'likes', 'comments']
  const keys = value.split(',').map((k) => k.trim()).filter(Boolean)
  if (keys.length === 0) throw new Error('--sort must not be empty')
  return keys.map((k) => {
    if (!allowed.includes(k as SortKey)) {
      throw new Error(`Invalid sort key "${k}". Allowed: ${allowed.join(', ')}`)
    }
    return k as SortKey
  })
}

interface SearchOpts {
  channel?: string
  limit: string
  sort: string
  order: string
  ascii: boolean
  wide: boolean
}

export const searchCommand = new Command('search')
  .description('Search YouTube videos by query')
  .argument('<query>', 'Search query')
  .option('--channel <ch>', 'Limit to a channel (ID, @handle, or URL)')
  .option('-n, --limit <n>', 'number of results to return', '25')
  .option('--sort <modes>', 'comma-separated sort keys: views,likes,comments', 'views')
  .option('--order <order>', 'asc | desc', 'desc')
  .option('--ascii', 'force ASCII table', false)
  .option('--wide', 'show description column', false)
  .action(async (query: string, opts: SearchOpts) => {
    const cfg = {
      query,
      channel: opts.channel,
      limit: Number(opts.limit),
      sort: parseSortKeys(opts.sort),
      order: (() => {
        if (opts.order !== 'asc' && opts.order !== 'desc') {
          throw new Error(`Invalid order "${opts.order as string}". Allowed: asc, desc`)
        }
        return opts.order as SortOrder
      })(),
      ascii: Boolean(opts.ascii),
      wide: Boolean(opts.wide),
    }
    await runSearch(cfg)
  })
```

**Step 2: Register the command in cli.ts**

In `src/cli.ts`, add import and `program.addCommand(searchCommand)`:

```typescript
import { searchCommand } from './modules/search'
// ...
program.addCommand(searchCommand)
```

**Step 3: Verify build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: No TypeScript errors.

**Step 4: Smoke test help**

```bash
node dist/cli.js search --help
```

Expected output includes: `search <query>`, `--channel`, `-n`, `--sort`, `--order`.

**Step 5: Commit**

```bash
git add src/modules/search/index.ts src/cli.ts
git commit -m "feat(search): add search CLI command"
```

---

### Task 5: Add MCP tool `search_videos`

**Files:**
- Modify: `src/mcp.ts`

**Step 1: Add import at the top of mcp.ts**

After existing imports, add:

```typescript
import { buildYouTubeClient, buildSearchResults, fetchStatsBatch } from './modules/search/service'
```

Wait — these are internal helpers not yet exported. Instead, we'll add a dedicated `searchVideos` function to the service.

**Step 1 (revised): Export a new function from service.ts**

Add to the bottom of `src/modules/search/service.ts`:

```typescript
export async function searchVideos(
  query: string,
  channelId?: string,
  limit = 25,
): Promise<VideoRecord[]> {
  const youtube = await buildYouTubeClient()

  const searchParams: youtube_v3.Params$Resource$Search$List = {
    part: ['snippet'],
    q: query,
    type: ['video'],
    maxResults: Math.min(limit, 50),
  }
  if (channelId) searchParams.channelId = channelId

  const searchRes = await youtube.search.list(searchParams)
  const searchItems = searchRes.data.items ?? []
  if (searchItems.length === 0) return []

  const videoIds = searchItems.map((i) => i.id?.videoId).filter((id): id is string => !!id)
  const statsItems = await fetchStatsBatch(youtube, videoIds)
  return buildSearchResults(searchItems, statsItems).slice(0, limit)
}
```

**Step 2: Register tool in mcp.ts**

Add the import at the top of `src/mcp.ts`:

```typescript
import { searchVideos } from './modules/search/service'
```

Add the tool registration after the last `server.registerTool(...)` block, before the `main()` function:

```typescript
// Tool 6: search_videos
server.registerTool(
  'search_videos',
  {
    description:
      'Search YouTube videos by query. Optionally scope to a specific channel. ' +
      'Returns video list with view/like/comment counts.',
    inputSchema: {
      query: z.string().describe('Search query'),
      channelId: z.string().optional().describe('YouTube channel ID to scope the search (UCxxx format)'),
      limit: z.number().optional().describe('Max results to return (default 25, max 50)'),
    },
  },
  async ({ query, channelId, limit }) => {
    const videos = await searchVideos(query, channelId, limit ?? 25)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(videos, null, 2) }],
    }
  },
)
```

**Step 3: Build to verify**

```bash
pnpm build 2>&1 | tail -10
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/modules/search/service.ts src/mcp.ts
git commit -m "feat(search): add search_videos MCP tool"
```

---

### Task 6: Run all tests and verify

**Step 1: Run full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: All tests pass, including new `service.test.ts`.

**Step 2: Run lint**

```bash
pnpm lint 2>&1 | tail -10
```

Expected: No errors.

**Step 3: Final commit if any fixes needed**

If lint/test fixes were required, commit them:

```bash
git add -p
git commit -m "fix(search): address lint and test issues"
```
