import path from 'path'
import fs from 'fs'
import os from 'os'
import { google } from 'googleapis'
import open from 'open'
import http from 'http'
import { renderTable } from './ui'

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'youtools', 'credentials.json')

async function ensureAuthClient() {
  // load client id/secret from environment variables for simplicity
  const clientId = process.env.YT_OAUTH_CLIENT_ID
  const clientSecret = process.env.YT_OAUTH_CLIENT_SECRET
  const redirectPort = 54321
  if (!clientId || !clientSecret) {
    throw new Error('Set YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET in env')
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${redirectPort}/oauth2callback`)

  // try load saved token
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8')
    const token = JSON.parse(raw)
    oauth2Client.setCredentials(token)
    return oauth2Client
  } catch (err) {
    // start flow
  }

  const scopes = ['https://www.googleapis.com/auth/youtube.readonly']
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes })
  await open(authUrl)

  const code = await new Promise<string>((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      if (!req.url) return
      const u = new URL(req.url, `http://localhost:${redirectPort}`)
      const c = u.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('You can close this window and return to the CLI')
      if (c) {
        resolve(c)
        srv.close()
      } else {
        reject(new Error('No code received'))
      }
    })
    srv.listen(54321)
  })

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // save token
  try {
    fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true })
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(tokens), { mode: 0o600 })
  } catch (err) {
    // ignore
  }

  return oauth2Client
}

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
  const auth = await ensureAuthClient()
  const youtube = google.youtube({ version: 'v3', auth })

  // get own channel id for author detection
  const meRes = await youtube.channels.list({ part: ['snippet'], mine: true })
  const myChannelId = meRes.data.items && meRes.data.items[0] && meRes.data.items[0].id

  const threads = await fetchCommentThreads(youtube, cfg.videoId, cfg.limit)

  const scored = threads.map((it: any) => ({
    id: it.id,
    ...scoreComment(it, myChannelId || null, cfg.authorBonus),
  }))

  // sort
  const mode = cfg.sort
  const order = cfg.order === 'asc' ? 1 : -1
  scored.sort((a: any, b: any) => {
    if (mode === 'likes') return (a.likes - b.likes) * order
    if (mode === 'time') return (new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()) * order
    if (mode === 'replies') return (a.replies - b.replies) * order
    // likes_plus_author
    return (a.score - b.score) * order
  })

  renderTable(scored, { ascii: cfg.ascii, wide: cfg.wide })
}
