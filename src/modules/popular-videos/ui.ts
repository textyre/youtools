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
    // eslint-disable-next-line no-console
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
