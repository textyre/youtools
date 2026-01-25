import { google } from 'googleapis'
import { renderTable } from './ui'
import { ensureAuthClient as ensureOauthClient } from '../../lib/googleAuth'

async function fetchCommentThreads(youtube: any, videoId: string, limit: number) {
  const results: any[] = []
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
    nextPageToken = res.data.nextPageToken
    if (!nextPageToken) break
  }
  return results.slice(0, limit)
}

function scoreComment(item: any, channelId: string | null, authorBonus = 1000) {
  const c = item.snippet.topLevelComment.snippet
  const likes = Number(c.likeCount || 0)
  const replies = Number(item.snippet.totalReplyCount || 0)
  let authorReplied = false
  if (item.replies && item.replies.comments) {
    for (const r of item.replies.comments) {
      const aId = r.snippet.authorChannelId && r.snippet.authorChannelId.value
      if (aId && channelId && aId === channelId) {
        authorReplied = true
        break
      }
    }
  }
  const score = likes + (authorReplied ? authorBonus : 0)
  return { likes, replies, authorReplied, score, publishedAt: c.publishedAt, text: c.textDisplay, author: c.authorDisplayName }
}

export async function runPopularComments(cfg: any) {
  const apiKey = process.env.YT_API_KEY
  let youtube: any
  let myChannelId: string | null = null

  // create youtube client depending on auth method
  if (apiKey) {
    youtube = google.youtube({ version: 'v3', auth: apiKey })
  } else {
    const auth = await ensureOauthClient()
    youtube = google.youtube({ version: 'v3', auth })
  }

  // Always fetch the video's snippet to determine the video's owner channel id.
  const vidRes = await youtube.videos.list({ part: ['snippet'], id: cfg.videoId })
  const videoOwnerChannelId = vidRes.data.items && vidRes.data.items[0] && vidRes.data.items[0].snippet && vidRes.data.items[0].snippet.channelId

  const threads = await fetchCommentThreads(youtube, cfg.videoId, cfg.limit)

  const scored = threads.map((it: any) => ({
    id: it.id,
    ...scoreComment(it, videoOwnerChannelId || null, cfg.authorBonus),
  }))

  // sort
  const mode = cfg.sort
  const order = cfg.order === 'asc' ? 1 : -1
  scored.sort((a: any, b: any) => {
    if (mode === 'likes') return (a.likes - b.likes) * order
    if (mode === 'time') return (new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()) * order
    if (mode === 'replies') return (a.replies - b.replies) * order
    if (mode === 'length') return (a.text.length - b.text.length) * order
    // likes_plus_author
    return (a.score - b.score) * order
  })

  await renderTable(scored, { ascii: cfg.ascii, wide: cfg.wide, expand: cfg.wide })
}
