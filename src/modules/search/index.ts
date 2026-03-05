import { Command } from 'commander'
import { runSearch } from './service'
import { SortKey, SortOrder } from './types'

function parseSortKeys(value: string): SortKey[] {
  const allowed: SortKey[] = ['views', 'likes', 'comments']
  const keys = value.split(',').map((k) => k.trim()).filter(Boolean)
  if (keys.length === 0) throw new Error('--sort must not be empty')
  return keys.map((k) => {
    if (!allowed.includes(k as SortKey)) {
      throw new Error(`Invalid sort key "${k}". Allowed: ${allowed.join(', ')}`)
    }
    return k as SortKey
  })
}

interface SearchOpts {
  channel?: string
  limit: string
  maxScan: string
  sort: string
  order: string
  table: boolean
  ascii: boolean
  wide: boolean
}

export const searchCommand = new Command('search')
  .description('Search YouTube videos by query')
  .argument('<query>', 'Search query')
  .option('--channel <ch>', 'Limit to a channel (ID, @handle, or URL)')
  .option('-n, --limit <n>', 'number of results to show (0 = all)', '0')
  .option('--max-scan <n>', 'max results to fetch from YouTube (0 = all)', '0')
  .option('--sort <modes>', 'comma-separated sort keys: views,likes,comments', 'views')
  .option('--order <order>', 'asc | desc', 'desc')
  .option('--table', 'output as table instead of markdown', false)
  .option('--ascii', 'force ASCII table (implies --table)', false)
  .option('--wide', 'show description column (implies --table)', false)
  .action(async (query: string, opts: SearchOpts) => {
    const cfg = {
      query,
      channel: opts.channel,
      limit: Number(opts.limit),
      maxScan: Number(opts.maxScan),
      sort: parseSortKeys(opts.sort),
      order: (() => {
        if (opts.order !== 'asc' && opts.order !== 'desc') {
          throw new Error(`Invalid order "${opts.order as string}". Allowed: asc, desc`)
        }
        return opts.order as SortOrder
      })(),
      table: Boolean(opts.table) || Boolean(opts.ascii) || Boolean(opts.wide),
      ascii: Boolean(opts.ascii),
      wide: Boolean(opts.wide),
    }
    await runSearch(cfg)
  })
