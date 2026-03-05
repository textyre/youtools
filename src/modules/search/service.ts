import { google, youtube_v3 } from 'googleapis'
import { ensureAuthClient } from '../../lib/googleAuth'
import { VideoRecord, SearchCfg } from './types'
import { parseChannelInput } from '../popular-videos/channel'
import { compositeSort } from '../popular-videos/sort'
import { renderMarkdown, renderTable } from './ui'

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

async function fetchSearchItems(
  youtube: youtube_v3.Youtube,
  params: youtube_v3.Params$Resource$Search$List,
  maxScan: number,
): Promise<youtube_v3.Schema$SearchResult[]> {
  const items: youtube_v3.Schema$SearchResult[] = []
  let nextPageToken: string | undefined

  do {
    const res = await youtube.search.list({ ...params, pageToken: nextPageToken })
    items.push(...(res.data.items ?? []))
    nextPageToken = res.data.nextPageToken ?? undefined
    if (maxScan > 0 && items.length >= maxScan) break
  } while (nextPageToken)

  return maxScan > 0 ? items.slice(0, maxScan) : items
}

export async function runSearch(cfg: SearchCfg): Promise<void> {
  const youtube = await buildYouTubeClient()

  const searchParams: youtube_v3.Params$Resource$Search$List = {
    part: ['snippet'],
    q: cfg.query,
    type: ['video'],
    maxResults: 50,
  }

  if (cfg.channel) {
    searchParams.channelId = await resolveChannelId(youtube, cfg.channel)
  }

  const searchItems = await fetchSearchItems(youtube, searchParams, cfg.maxScan)

  if (searchItems.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No results found.')
    return
  }

  const videoIds = searchItems.map((i) => i.id?.videoId).filter((id): id is string => !!id)
  const statsItems = await fetchStatsBatch(youtube, videoIds)
  const videos = buildSearchResults(searchItems, statsItems)
  const allSorted = compositeSort(videos, cfg.sort, cfg.order)
  const sorted = cfg.limit > 0 ? allSorted.slice(0, cfg.limit) : allSorted
  if (cfg.table) {
    await renderTable(sorted, cfg)
  } else {
    renderMarkdown(sorted)
  }
}

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
    maxResults: 50,
  }
  if (channelId) searchParams.channelId = channelId

  const searchRes = await youtube.search.list(searchParams)
  const searchItems = searchRes.data.items ?? []
  if (searchItems.length === 0) return []

  const videoIds = searchItems.map((i) => i.id?.videoId).filter((id): id is string => !!id)
  const statsItems = await fetchStatsBatch(youtube, videoIds)
  const sorted = compositeSort(buildSearchResults(searchItems, statsItems), ['views'], 'desc')
  return limit > 0 ? sorted.slice(0, limit) : sorted
}
