import Table from 'cli-table3'
import chalk from 'chalk'

export function renderTable(items: any[], opts: { ascii?: boolean; wide?: boolean } = {}) {
  const table = new Table({
    head: ['#', 'Author', 'Comment', 'Likes', 'Replies', 'Date', 'Flag'],
    style: { border: [], head: [] },
    chars: opts.ascii
      ? { top: '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+', bottom: '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+', left: '|', 'left-mid': '+', mid: '-', 'mid-mid': '+', right: '|', 'right-mid': '+', middle: '|' }
      : undefined,
  })

  let i = 1
  for (const it of items) {
    const author = it.author
    const text = opts.wide ? it.text : (it.text && it.text.length > 80 ? it.text.slice(0, 77) + '...' : it.text)
    const flag = it.authorReplied ? chalk.yellow('★') : ''
    table.push([i, author, text, String(it.likes), String(it.replies), it.publishedAt, flag])
    i += 1
  }

  // eslint-disable-next-line no-console
  console.log(table.toString())
}
