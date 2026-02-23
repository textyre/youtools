# popular-videos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `youtools popular-videos <channel>` command that fetches and ranks the top N videos of a YouTube channel by views, likes, and/or comments with disk caching.

**Architecture:** New `src/modules/popular-videos/` module with four files (index, service, cache, ui). Channel input (ID / @handle / URL) is normalised to a channel ID, then all video IDs are collected via the uploads playlist, statistics are batch-fetched, and results are sorted client-side by one or more metrics.

**Tech Stack:** TypeScript, googleapis v119, commander, cli-table3, chalk, jest + ts-jest

---

## Task 1: Configure Jest (no tests exist yet)

**Files:**
- Create: `jest.config.js`

**Step 1: Create jest.config.js**

```js
// jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
}
```

**Step 2: Verify jest works**

Run: `pnpm test`
Expected: "No tests found, exiting with code 1" — that's fine, infrastructure is ready.

**Step 3: Commit**

```bash
git add jest.config.js
git commit -m "chore: configure jest with ts-jest"
```

---

## Task 2: Types + compositeSort (TDD)

**Files:**
- Create: `src/modules/popular-videos/types.ts`
- Create: `src/modules/popular-videos/sort.ts`
- Create: `src/modules/popular-videos/sort.test.ts`

**Step 1: Write the failing test**

Create `src/modules/popular-videos/sort.test.ts`:

```typescript
import { compositeSort } from './sort'
import { VideoRecord } from './types'

const v = (id: string, views: number, likes: number, comments: number): VideoRecord => ({
  id,
  title: id,
  publishedAt: '2024-01-01T00:00:00Z',
  description: '',
  viewCount: views,
  likeCount: likes,
  commentCount: comments,
})

describe('compositeSort', () => {
  it('sorts by single key desc', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1), v('c', 50, 9, 1)]
    const result = compositeSort(videos, ['views'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by single key asc', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1), v('c', 50, 9, 1)]
    const result = compositeSort(videos, ['views'], 'asc')
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('uses second key as tiebreaker', () => {
    const videos = [v('a', 100, 5, 1), v('b', 100, 10, 1), v('c', 100, 3, 1)]
    const result = compositeSort(videos, ['views', 'likes'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('supports comments key', () => {
    const videos = [v('a', 100, 5, 20), v('b', 100, 5, 5), v('c', 100, 5, 50)]
    const result = compositeSort(videos, ['comments'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the input array', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1)]
    const original = [...videos]
    compositeSort(videos, ['views'], 'desc')
    expect(videos).toEqual(original)
  })
})
```

**Step 2: Run to confirm FAIL**

Run: `pnpm test sort.test`
Expected: FAIL — "Cannot find module './sort'"

**Step 3: Create types.ts**

```typescript
// src/modules/popular-videos/types.ts
export interface VideoRecord {
  id: string
  title: string
  publishedAt: string
  description: string
  viewCount: number
  likeCount: number
  commentCount: number
}

export type SortKey = 'views' | 'likes' | 'comments'
export type SortOrder = 'asc' | 'desc'
```

**Step 4: Create sort.ts**

```typescript
// src/modules/popular-videos/sort.ts
import { VideoRecord, SortKey, SortOrder } from './types'

function getValue(v: VideoRecord, key: SortKey): number {
  if (key === 'views') return v.viewCount
  if (key === 'likes') return v.likeCount
  return v.commentCount
}

export function compositeSort(videos: VideoRecord[], keys: SortKey[], order: SortOrder): VideoRecord[] {
  const dir = order === 'desc' ? -1 : 1
  return [...videos].sort((a, b) => {
    for (const key of keys) {
      const diff = (getValue(a, key) - getValue(b, key)) * dir
      if (diff !== 0) return diff
    }
    return 0
  })
}
```

**Step 5: Run tests — expect PASS**

Run: `pnpm test sort.test`
Expected: PASS — 5 tests

**Step 6: Commit**

```bash
git add src/modules/popular-videos/types.ts src/modules/popular-videos/sort.ts src/modules/popular-videos/sort.test.ts
git commit -m "feat: add VideoRecord types and compositeSort with tests"
```

---

## Task 3: parseChannelInput (TDD)

**Files:**
- Create: `src/modules/popular-videos/channel.ts`
- Create: `src/modules/popular-videos/channel.test.ts`

**Step 1: Write the failing test**

Create `src/modules/popular-videos/channel.test.ts`:

```typescript
import { parseChannelInput, ChannelInput } from './channel'

describe('parseChannelInput', () => {
  it('detects raw channel ID starting with UC', () => {
    expect(parseChannelInput('UCxxxxxxxxxxxxxxxxxxxxxx')).toEqual({
      type: 'id',
      value: 'UCxxxxxxxxxxxxxxxxxxxxxx',
    } as ChannelInput)
  })

  it('detects @handle', () => {
    expect(parseChannelInput('@mkbhd')).toEqual({ type: 'handle', value: 'mkbhd' })
  })

  it('extracts channel ID from youtube.com/channel/ URL', () => {
    expect(parseChannelInput('https://www.youtube.com/channel/UCxxxxxx')).toEqual({
      type: 'id',
      value: 'UCxxxxxx',
    })
  })

  it('extracts handle from youtube.com/@handle URL', () => {
    expect(parseChannelInput('https://youtube.com/@mkbhd')).toEqual({
      type: 'handle',
      value: 'mkbhd',
    })
  })

  it('extracts username from legacy youtube.com/user/ URL', () => {
    expect(parseChannelInput('https://youtube.com/user/mkbhd')).toEqual({
      type: 'username',
      value: 'mkbhd',
    })
  })

  it('throws on unrecognised input', () => {
    expect(() => parseChannelInput('not-a-channel')).toThrow()
  })
})
```

**Step 2: Run to confirm FAIL**

Run: `pnpm test channel.test`
Expected: FAIL — "Cannot find module './channel'"

**Step 3: Implement channel.ts**

```typescript
// src/modules/popular-videos/channel.ts
export type ChannelInput =
  | { type: 'id'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'username'; value: string }

export function parseChannelInput(raw: string): ChannelInput {
  // Raw channel ID (starts with UC, HC, etc. — all YT channel IDs are 24 chars starting with UC)
  if (/^UC[\w-]{22}$/.test(raw)) {
    return { type: 'id', value: raw }
  }

  // @handle (without URL)
  if (raw.startsWith('@')) {
    return { type: 'handle', value: raw.slice(1) }
  }

  // URL forms
  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    throw new Error(`Cannot parse channel input: ${raw}`)
  }

  const pathname = url.pathname

  // /channel/UCxxx
  const channelMatch = pathname.match(/^\/channel\/(UC[\w-]+)/)
  if (channelMatch) return { type: 'id', value: channelMatch[1] }

  // /@handle
  const handleMatch = pathname.match(/^\/@([\w-]+)/)
  if (handleMatch) return { type: 'handle', value: handleMatch[1] }

  // /user/username
  const userMatch = pathname.match(/^\/user\/([\w-]+)/)
  if (userMatch) return { type: 'username', value: userMatch[1] }

  throw new Error(`Cannot parse channel input: ${raw}`)
}
```

**Step 4: Run tests — expect PASS**

Run: `pnpm test channel.test`
Expected: PASS — 6 tests

**Step 5: Commit**

```bash
git add src/modules/popular-videos/channel.ts src/modules/popular-videos/channel.test.ts
git commit -m "feat: add channel input parser with tests"
```

---

## Task 4: Disk cache (TDD for pure logic, integration for I/O)

**Files:**
- Create: `src/modules/popular-videos/cache.ts`
- Create: `src/modules/popular-videos/cache.test.ts`

**Step 1: Write the failing test**

Create `src/modules/popular-videos/cache.test.ts`:

```typescript
import { isCacheFresh } from './cache'

describe('isCacheFresh', () => {
  it('returns true when fetchedAt is within TTL', () => {
    const fetchedAt = new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    expect(isCacheFresh(fetchedAt, 3600)).toBe(true)
  })

  it('returns false when fetchedAt is older than TTL', () => {
    const fetchedAt = new Date(Date.now() - 1000 * 60 * 90).toISOString() // 90 min ago
    expect(isCacheFresh(fetchedAt, 3600)).toBe(false)
  })

  it('returns false for TTL of 0', () => {
    const fetchedAt = new Date(Date.now() - 1).toISOString()
    expect(isCacheFresh(fetchedAt, 0)).toBe(false)
  })
})
```

**Step 2: Run to confirm FAIL**

Run: `pnpm test cache.test`
Expected: FAIL — "Cannot find module './cache'"

**Step 3: Implement cache.ts**

```typescript
// src/modules/popular-videos/cache.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { VideoRecord } from './types'

const CACHE_DIR = path.join(os.homedir(), '.cache', 'youtools')

function cacheFilePath(channelId: string): string {
  return path.join(CACHE_DIR, `${channelId}-videos.json`)
}

export function isCacheFresh(fetchedAt: string, ttlSeconds: number): boolean {
  if (ttlSeconds <= 0) return false
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age < ttlSeconds * 1000
}

export function readCache(channelId: string, ttlSeconds: number): VideoRecord[] | null {
  const file = cacheFilePath(channelId)
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(raw) as { fetchedAt: string; videos: VideoRecord[] }
    if (!isCacheFresh(data.fetchedAt, ttlSeconds)) return null
    return data.videos
  } catch {
    return null
  }
}

export function writeCache(channelId: string, videos: VideoRecord[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    const file = cacheFilePath(channelId)
    const data = { fetchedAt: new Date().toISOString(), videos }
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 })
  } catch {
    // cache write failure is non-fatal
  }
}
```

**Step 4: Run tests — expect PASS**

Run: `pnpm test cache.test`
Expected: PASS — 3 tests

**Step 5: Commit**

```bash
git add src/modules/popular-videos/cache.ts src/modules/popular-videos/cache.test.ts
git commit -m "feat: add disk cache with TTL for popular-videos"
```

---

## Task 5: Fetch logic in service.ts (no unit tests — API-dependent)

**Files:**
- Create: `src/modules/popular-videos/service.ts`

**Step 1: Create service.ts**

```typescript
// src/modules/popular-videos/service.ts
import { google } from 'googleapis'
import { ensureAuthClient } from '../../lib/googleAuth'
import { VideoRecord, SortKey, SortOrder } from './types'
import { parseChannelInput } from './channel'
import { readCache, writeCache } from './cache'
import { compositeSort } from './sort'
import { renderTable } from './ui'

export interface PopularVideosCfg {
  channel: string
  limit: number
  sort: SortKey[]
  order: SortOrder
  maxScan: number
  cacheTtl: number
  noCache: boolean
  ascii: boolean
  wide: boolean
}

async function buildYouTubeClient() {
  const apiKey = process.env.YT_API_KEY
  if (apiKey) return google.youtube({ version: 'v3', auth: apiKey })
  const auth = await ensureAuthClient()
  return google.youtube({ version: 'v3', auth })
}

async function resolveChannelId(youtube: any, raw: string): Promise<string> {
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

async function fetchVideoIds(youtube: any, uploadsPlaylistId: string, maxScan: number): Promise<string[]> {
  const ids: string[] = []
  let nextPageToken: string | undefined

  while (true) {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    })
    for (const item of res.data.items ?? []) {
      const videoId = item.contentDetails?.videoId
      if (videoId) ids.push(videoId)
    }
    nextPageToken = res.data.nextPageToken
    if (!nextPageToken) break
    if (maxScan > 0 && ids.length >= maxScan) break
  }

  return maxScan > 0 ? ids.slice(0, maxScan) : ids
}

async function fetchVideoStats(youtube: any, videoIds: string[]): Promise<VideoRecord[]> {
  const records: VideoRecord[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: batch,
    })
    for (const item of res.data.items ?? []) {
      records.push({
        id: item.id,
        title: item.snippet?.title ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        description: (item.snippet?.description ?? '').slice(0, 200),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      })
    }
  }
  return records
}

export async function runPopularVideos(cfg: PopularVideosCfg): Promise<void> {
  const youtube = await buildYouTubeClient()
  const channelId = await resolveChannelId(youtube, cfg.channel)

  // Cache check
  if (!cfg.noCache) {
    const cached = readCache(channelId, cfg.cacheTtl)
    if (cached) {
      const top = compositeSort(cached, cfg.sort, cfg.order).slice(0, cfg.limit)
      await renderTable(top, cfg)
      return
    }
  }

  // Fetch uploads playlist ID
  const chanRes = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
  })
  const uploadsId = chanRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsId) {
    console.error('Could not find uploads playlist for channel.')
    process.exit(1)
  }

  // Fetch all video IDs
  const videoIds = await fetchVideoIds(youtube, uploadsId, cfg.maxScan)
  if (videoIds.length === 0) {
    console.warn('No videos found for this channel.')
    return
  }

  // Fetch statistics
  const videos = await fetchVideoStats(youtube, videoIds)

  // Cache results
  writeCache(channelId, videos)

  // Sort and render
  const top = compositeSort(videos, cfg.sort, cfg.order).slice(0, cfg.limit)
  await renderTable(top, cfg)
}
```

**Step 2: Run TypeScript compiler to check types**

Run: `pnpm build`
Expected: no errors (or fix any type errors before proceeding)

**Step 3: Commit**

```bash
git add src/modules/popular-videos/service.ts
git commit -m "feat: add popular-videos fetch service"
```

---

## Task 6: Table UI (ui.ts)

**Files:**
- Create: `src/modules/popular-videos/ui.ts`

**Step 1: Create ui.ts**

```typescript
// src/modules/popular-videos/ui.ts
import Table from 'cli-table3'
import { VideoRecord } from './types'

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

export async function renderTable(
  videos: VideoRecord[],
  opts: { ascii?: boolean; wide?: boolean }
): Promise<void> {
  if (videos.length === 0) {
    console.log('No videos to display.')
    return
  }

  const head = ['#', 'Title', 'Views', 'Likes', 'Comments', 'Published', 'ID']
  const colWidths = [4, 45, 9, 9, 10, 12, 13]

  if (opts.wide) {
    head.push('Description')
    colWidths.push(60)
  }

  const table = new Table({
    head,
    colWidths,
    wordWrap: true,
    style: { border: [], head: [] },
    chars: opts.ascii
      ? {
          top: '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
          bottom: '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+',
          left: '|', 'left-mid': '+', mid: '-', 'mid-mid': '+',
          right: '|', 'right-mid': '+', middle: '|',
        }
      : undefined,
  })

  videos.forEach((v, i) => {
    const row: (string | number)[] = [
      i + 1,
      v.title.slice(0, 43),
      fmtNum(v.viewCount),
      fmtNum(v.likeCount),
      fmtNum(v.commentCount),
      fmtDate(v.publishedAt),
      v.id,
    ]
    if (opts.wide) row.push(v.description.replace(/\n/g, ' ').slice(0, 58))
    table.push(row)
  })

  // eslint-disable-next-line no-console
  console.log(table.toString())
}
```

**Step 2: Verify build still passes**

Run: `pnpm build`
Expected: no errors

**Step 3: Commit**

```bash
git add src/modules/popular-videos/ui.ts
git commit -m "feat: add popular-videos table UI"
```

---

## Task 7: Commander command (index.ts)

**Files:**
- Create: `src/modules/popular-videos/index.ts`

**Step 1: Create index.ts**

```typescript
// src/modules/popular-videos/index.ts
import { Command } from 'commander'
import { runPopularVideos } from './service'
import { SortKey, SortOrder } from './types'

function parseSortKeys(value: string): SortKey[] {
  const allowed: SortKey[] = ['views', 'likes', 'comments']
  return value.split(',').map((k) => {
    const key = k.trim() as SortKey
    if (!allowed.includes(key)) {
      throw new Error(`Invalid sort key "${key}". Allowed: ${allowed.join(', ')}`)
    }
    return key
  })
}

export const popularVideosCommand = new Command('popular-videos')
  .description('Fetch the most popular videos of a YouTube channel')
  .argument('<channel>', 'Channel ID (UCxxx), @handle, or YouTube URL')
  .option('-n, --limit <n>', 'number of videos to return', '50')
  .option('--sort <modes>', 'comma-separated sort keys: views,likes,comments', 'views')
  .option('--order <order>', 'asc | desc', 'desc')
  .option('--max-scan <n>', 'max videos to scan (0 = all)', '0')
  .option('--cache-ttl <s>', 'cache TTL in seconds', '3600')
  .option('--no-cache', 'bypass cache and force fresh fetch')
  .option('--ascii', 'force ASCII table', false)
  .option('--wide', 'show description column', false)
  .action(async (channel: string, opts: any) => {
    const cfg = {
      channel,
      limit: Number(opts.limit),
      sort: parseSortKeys(opts.sort),
      order: (opts.order as SortOrder),
      maxScan: Number(opts.maxScan),
      cacheTtl: Number(opts.cacheTtl),
      noCache: !opts.cache,          // commander converts --no-cache to opts.cache = false
      ascii: Boolean(opts.ascii),
      wide: Boolean(opts.wide),
    }
    await runPopularVideos(cfg)
  })
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: no errors

**Step 3: Commit**

```bash
git add src/modules/popular-videos/index.ts
git commit -m "feat: add popular-videos commander command"
```

---

## Task 8: Register command in cli.ts

**Files:**
- Modify: `src/cli.ts`

**Step 1: Add import and register command**

In `src/cli.ts`, add after the existing import:

```typescript
import { popularVideosCommand } from './modules/popular-videos'
```

And after `program.addCommand(popularCommentsCommand)`:

```typescript
program.addCommand(popularVideosCommand)
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: no errors

**Step 3: Run smoke test**

Run: `pnpm dev -- popular-videos --help`
Expected: shows help text with all options listed

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: register popular-videos command in CLI"
```

---

## Task 9: Run all tests + final verification

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS (sort.test, channel.test, cache.test)

**Step 2: Run linter**

Run: `pnpm lint`
Expected: no errors (fix any that appear)

**Step 3: Build final artifact**

Run: `pnpm build`
Expected: `dist/` updated, no errors

**Step 4: Final commit if lint/format changes were needed**

```bash
git add -A
git commit -m "chore: fix lint/format issues after popular-videos implementation"
```

---

## Quick Reference

### Running during development

```bash
# Dev mode (ts-node)
pnpm dev -- popular-videos @mkbhd --limit 10 --sort views

# With API key
YT_API_KEY=xxx pnpm dev -- popular-videos UCxxxxxx --limit 20 --sort likes,views

# Force refresh
pnpm dev -- popular-videos @channel --no-cache --max-scan 100

# Wide output
pnpm dev -- popular-videos @channel --wide --ascii
```

### File tree after implementation

```
src/
  cli.ts                              (modified: +1 import, +1 addCommand)
  modules/
    popular-comments/                 (untouched)
    popular-videos/
      types.ts
      sort.ts
      sort.test.ts
      channel.ts
      channel.test.ts
      cache.ts
      cache.test.ts
      service.ts
      ui.ts
      index.ts
jest.config.js                        (new)
```
