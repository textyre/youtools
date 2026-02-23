import { google, youtube_v3 } from 'googleapis'
import { CommentItem, renderTable } from './ui'
import { ensureAuthClient as ensureOauthClient } from '../../lib/googleAuth'

async function fetchCommentThreads(youtube: youtube_v3.Youtube, videoId: string, limit: number): Promise<youtube_v3.Schema$CommentThread[]> {
  const results: youtube_v3.Schema$CommentThread[] = []
  let nextPageToken: string | undefined
  while (results.length < limit) {
    const res = await youtube.commentThreads.list({
      part: ['snippet', 'replies'],
      videoId,
      maxResults: 100,
      pageToken: nextPageToken,
      textFormat: 'plainText',
    })
    const items = res.data.items || []
    results.push(...items)
    nextPageToken = res.data.nextPageToken ?? undefined
    if (!nextPageToken) break
  }
  return results.slice(0, limit)
}

function scoreComment(item: youtube_v3.Schema$CommentThread, channelId: string | null, authorBonus = 1000): Omit<CommentItem, 'id'> {
  const c = item.snippet?.topLevelComment?.snippet
  const likes = Number(c?.likeCount ?? 0)
  const replies = Number(item.snippet?.totalReplyCount ?? 0)
  let authorReplied = false
  if (item.replies?.comments) {
    for (const r of item.replies.comments) {
      const aId = r.snippet?.authorChannelId?.value
      if (aId && channelId && aId === channelId) {
        authorReplied = true
        break
      }
    }
  }
  const score = likes + (authorReplied ? authorBonus : 0)
  return { likes, replies, authorReplied, score, publishedAt: c?.publishedAt, text: c?.textDisplay, author: c?.authorDisplayName }
}

export interface PopularCommentsCfg {
  videoId: string
  limit: number
  sort: string
  order: string
  ascii: boolean
  wide: boolean
  pager: boolean
  scanReplies: boolean
  authorBonus: number
}

export async function runPopularComments(cfg: PopularCommentsCfg): Promise<void> {
  const apiKey = process.env.YT_API_KEY
  let youtube: youtube_v3.Youtube

  // create youtube client depending on auth method
  if (apiKey) {
    youtube = google.youtube({ version: 'v3', auth: apiKey })
  } else {
    const auth = await ensureOauthClient()
    youtube = google.youtube({ version: 'v3', auth })
  }

  // Always fetch the video's snippet to determine the video's owner channel id.
  const vidRes = await youtube.videos.list({ part: ['snippet'], id: [cfg.videoId] })
  const videoOwnerChannelId = vidRes.data.items?.[0]?.snippet?.channelId ?? null

  const threads = await fetchCommentThreads(youtube, cfg.videoId, cfg.limit)

  const scored: CommentItem[] = threads.map((it) => ({
    id: it.id,
    ...scoreComment(it, videoOwnerChannelId, cfg.authorBonus),
  }))

  // sort
  const mode = cfg.sort
  const order = cfg.order === 'asc' ? 1 : -1
  scored.sort((a, b) => {
    if (mode === 'likes') return (a.likes - b.likes) * order
    if (mode === 'time') return (new Date(String(a.publishedAt)).getTime() - new Date(String(b.publishedAt)).getTime()) * order
    if (mode === 'replies') return (a.replies - b.replies) * order
    if (mode === 'length') return (String(a.text).length - String(b.text).length) * order
    // likes_plus_author
    return (a.score - b.score) * order
  })

  await renderTable(scored, { ascii: cfg.ascii, wide: cfg.wide, expand: cfg.wide })
}
