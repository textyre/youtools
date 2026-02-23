import Table from 'cli-table3'
import chalk from 'chalk'
import prompts from 'prompts'
import { spawnSync } from 'child_process'

export interface CommentItem {
  id?: string | null
  author?: string | null
  text?: string | null
  likes: number
  replies: number
  authorReplied: boolean
  score: number
  publishedAt?: string | null
}

function wrapText(text: string, width: number) {
  if (!text) return ''
  const words = text.split(/(\s+)/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + w).length > width) {
      if (cur) lines.push(cur)
      // if single word longer than width, hard cut
      if (w.length > width) {
        let i = 0
        while (i < w.length) {
          lines.push(w.slice(i, i + width))
          i += width
        }
        cur = ''
      } else {
        cur = w.trimStart()
      }
    } else {
      cur += w
    }
  }
  if (cur) lines.push(cur)
  return lines.join('\n')
}

function decodeHtml(html: string) {
  if (!html) return ''
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
}

function normalizeHtmlText(s: string) {
  if (!s) return ''
  let t = decodeHtml(s)
  // convert <br> to newlines and remove other tags
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<[^>]+>/g, '')
  return t
}

export async function renderTable(items: CommentItem[], opts: { ascii?: boolean; wide?: boolean; expand?: boolean; pager?: boolean } = {}) {
  const termWidth = (process && process.stdout && process.stdout.columns) ? process.stdout.columns : 120
  const otherCols = 4 + 20 + 8 + 8 + 24 + 6 // estimation including paddings
  const commentColWidth = opts.wide ? Math.max(60, termWidth - otherCols) : Math.max(40, Math.min(120, termWidth - otherCols))

  // If wide is set, print full expanded blocks instead of a table so comments are fully visible.
  if (opts.wide) {
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx]
      console.log('='.repeat(80))
      console.log(`#${idx + 1}  Author: ${it.author}  Likes: ${it.likes}  Replies: ${it.replies}  Date: ${it.publishedAt} ${it.authorReplied ? chalk.yellow('★') : ''}`)
      console.log('-'.repeat(80))
      console.log(it.text || '')
      console.log('\n')
    }
    return
  }

  const table = new Table({
    head: ['#', 'Author', 'Comment', 'Likes', 'Replies', 'Date', 'Flag'],
    style: { border: [], head: [] },
    colWidths: [4, 20, commentColWidth, 8, 8, 24, 6],
    wordWrap: true,
    chars: opts.ascii
      ? { top: '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+', bottom: '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+', left: '|', 'left-mid': '+', mid: '-', 'mid-mid': '+', right: '|', 'right-mid': '+', middle: '|' }
      : undefined,
  })

  let i = 1
  for (const it of items) {
    const author = it.author
    const rawText = normalizeHtmlText((it.text || '').replace(/\r?\n/g, ' '))
    const wrapped = wrapText(rawText, commentColWidth)
    const flag = it.authorReplied ? chalk.yellow('★') : ''
    table.push([i, author, wrapped, String(it.likes), String(it.replies), it.publishedAt, flag])
    i += 1
  }

  // eslint-disable-next-line no-console
  console.log(table.toString())

  if (process.stdin.isTTY) {
    // interactive expand
    const response = await prompts({
      type: 'text',
      name: 'sel',
      message: 'Enter comment number to expand (empty to exit)',
    })
    const val = response.sel && response.sel.trim()
    if (val) {
      const n = Number(val)
      if (!Number.isNaN(n) && n >= 1 && n <= items.length) {
        const it = items[n - 1]
        if (opts.pager) {
          const text = ['#' + n + ' Author: ' + it.author + ' Likes: ' + it.likes + ' Replies: ' + it.replies + ' Date: ' + it.publishedAt + (it.authorReplied ? ' ★' : ''), '', it.text || ''].join('\n')
          // try less, then more
          const pager = spawnSync('less', ['-R'], { input: text, stdio: ['pipe', 'inherit', 'inherit'] })
          if (pager.error) {
            spawnSync('more', [], { input: text, stdio: ['pipe', 'inherit', 'inherit'] })
          }
        } else {
          console.log('\n' + '='.repeat(80))
          console.log(`#${n}  Author: ${it.author}  Likes: ${it.likes}  Replies: ${it.replies}  Date: ${it.publishedAt} ${it.authorReplied ? chalk.yellow('★') : ''}`)
          console.log('-'.repeat(80))
          console.log(it.text || '')
          console.log('\n')
        }
      }
    }
  } else {
    console.log('\nTip: run with --wide or in a TTY to interactively expand comments')
  }
}
