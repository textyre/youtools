import { google, youtube_v3 } from 'googleapis'
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

async function fetchVideoIds(youtube: youtube_v3.Youtube, uploadsPlaylistId: string, maxScan: number): Promise<string[]> {
  const ids: string[] = []
  let nextPageToken: string | undefined

  do {
    const res = await youtube.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    })
    for (const item of (res.data.items ?? [])) {
      const videoId = item.contentDetails?.videoId
      if (videoId) ids.push(videoId)
    }
    nextPageToken = res.data.nextPageToken ?? undefined
    if (maxScan > 0 && ids.length >= maxScan) break
  } while (nextPageToken)

  return maxScan > 0 ? ids.slice(0, maxScan) : ids
}

async function fetchVideoStats(youtube: youtube_v3.Youtube, videoIds: string[]): Promise<VideoRecord[]> {
  const records: VideoRecord[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: batch,
    })
    for (const item of (res.data.items ?? [])) {
      if (!item.id) continue
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
    throw new Error('Could not find uploads playlist for channel.')
  }

  // Fetch all video IDs
  const videoIds = await fetchVideoIds(youtube, uploadsId, cfg.maxScan)
  if (videoIds.length === 0) {
    // eslint-disable-next-line no-console
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
