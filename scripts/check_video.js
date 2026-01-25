const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')

function readApiKey() {
  const p = path.join(os.homedir(), '.config', 'youtools', 'credentials.json')
  if (!fs.existsSync(p)) throw new Error('credentials.json not found: ' + p)
  const raw = fs.readFileSync(p, 'utf8')
  try {
    const j = JSON.parse(raw)
    return j.YT_API_KEY || j.yt_api_key || j.api_key || j.key || j.key_string || j
  } catch (e) {
    // fallback: raw contains the key
    return raw.trim()
  }
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 3) + '...' : s
}

async function run(videoId, opts = {}) {
  const key = readApiKey()
  if (!key) throw new Error('API key not found in credentials.json')

  const vidsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${encodeURIComponent(key)}`
  const vidRes = await getJson(vidsUrl)
  if (!vidRes.items || !vidRes.items.length) {
    console.error('Video not found')
    return
  }
  const video = vidRes.items[0]
  const ownerChannelId = video.snippet && video.snippet.channelId

  console.error('Video title:', video.snippet.title)
  console.error('Owner channelId:', ownerChannelId)

  let comments = []
  let nextPageToken = ''
  while (true) {
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=100&pageToken=${nextPageToken || ''}&key=${encodeURIComponent(key)}`
    const res = await getJson(url)
    const items = res.items || []
    comments = comments.concat(items)
    if (!res.nextPageToken) break
    nextPageToken = res.nextPageToken
    if (comments.length >= 500) break
  }

  const processed = comments.map((it) => {
    const c = it.snippet.topLevelComment.snippet
    const likes = Number(c.likeCount || 0)
    const replies = Number(it.snippet.totalReplyCount || 0)
    let authorReplied = false
    if (it.replies && it.replies.comments) {
      for (const r of it.replies.comments) {
        const aId = r.snippet.authorChannelId && r.snippet.authorChannelId.value
        if (aId && ownerChannelId && aId === ownerChannelId) {
          authorReplied = true
          break
        }
      }
    }
    return {
      author: c.authorDisplayName,
      text: c.textDisplay,
      likes,
      replies,
      authorReplied,
      score: likes + (authorReplied ? 1000 : 0),
    }
  })
  // sorting
  const mode = (opts && opts.sort) || 'score'
  const order = (opts && opts.order) === 'asc' ? 1 : -1
  processed.sort((a, b) => {
    if (mode === 'length') return (a.text.length - b.text.length) * order
    if (mode === 'likes') return (a.likes - b.likes) * order
    if (mode === 'replies') return (a.replies - b.replies) * order
    // default: score
    return (a.score - b.score) * order
  })

  // Print each comment as a full block for easy reading
  const limit = (opts && opts.limit) || 50
  const rows = processed.slice(0, limit)
  let idx = 1
  function decodeHtml(html) {
    if (!html) return ''
    return html.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
  }

  for (const r of rows) {
    const flag = r.authorReplied ? ' ★ (author replied)' : ''
    console.log('='.repeat(120))
    console.log(`#${idx}  Author: ${r.author}  Likes: ${r.likes}  Replies: ${r.replies}  Len: ${ (r.text||'').length }${flag}`)
    console.log('-'.repeat(120))
    console.log(decodeHtml(r.text || ''))
    console.log('\n')
    idx += 1
  }
}

// Simple CLI args: [videoId] [-s|--sort <likes|length|replies|score>] [-o|--order <asc|desc>] [-l|--limit <n>]
function parseArgs() {
  const argv = process.argv.slice(2)
  const out = { videoId: undefined, sort: 'score', order: 'desc', limit: 50 }
  let i = 0
  while (i < argv.length) {
    const a = argv[i]
    if (a === '-s' || a === '--sort') {
      out.sort = argv[i + 1] || out.sort
      i += 2
    } else if (a === '-o' || a === '--order') {
      out.order = argv[i + 1] || out.order
      i += 2
    } else if (a === '-l' || a === '--limit') {
      out.limit = Number(argv[i + 1]) || out.limit
      i += 2
    } else if (a.startsWith('-')) {
      // unknown flag, skip
      i += 1
    } else {
      if (!out.videoId) out.videoId = a
      i += 1
    }
  }
  if (!out.videoId) out.videoId = 'Jcuig8vhmx4'
  return out
}

const parsed = parseArgs()
run(parsed.videoId, parsed).catch((e) => {
  console.error('Error:', e && e.message)
  process.exit(1)
})
