import { VideoRecord } from './types'
import { renderTable } from '../popular-videos/ui'

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtDate(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

export function renderMarkdown(videos: VideoRecord[]): void {
  if (videos.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No videos found.')
    return
  }

  const lines: string[] = [
    '| # | Title | Views | Likes | Comments | Published |',
    '|---|-------|-------|-------|----------|-----------|',
  ]

  videos.forEach((v, i) => {
    const title = `[${v.title}](https://youtu.be/${v.id})`
    lines.push(
      `| ${i + 1} | ${title} | ${fmtNum(v.viewCount)} | ${fmtNum(v.likeCount)} | ${fmtNum(v.commentCount)} | ${fmtDate(v.publishedAt)} |`
    )
  })

  // eslint-disable-next-line no-console
  console.log(lines.join('\n'))
}

export { renderTable }
