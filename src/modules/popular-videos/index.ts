import { Command } from 'commander'
import { runPopularVideos } from './service'
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

interface PopularVideosOpts {
  limit: string
  sort: string
  order: string
  maxScan: string
  cacheTtl: string
  cache: boolean
  ascii: boolean
  wide: boolean
}

export const popularVideosCommand = new Command('popular-videos')
  .description('Fetch the most popular videos of a YouTube channel')
  .argument('<channel>', 'Channel ID (UCxxx), @handle, or YouTube URL')
  .option('-n, --limit <n>', 'number of videos to return', '50')
  .option('--sort <modes>', 'comma-separated sort keys: views,likes,comments', 'views')
  .option('--order <order>', 'asc | desc', 'desc')
  .option('--max-scan <n>', 'max videos to scan (0 = all)', '0')
  .option('--cache-ttl <s>', 'cache TTL in seconds', '3600')
  .option('--no-cache', 'bypass cache and force fresh fetch')
  .option('--ascii', 'force ASCII table', false)
  .option('--wide', 'show description column', false)
  .action(async (channel: string, opts: PopularVideosOpts) => {
    const cfg = {
      channel,
      limit: Number(opts.limit),
      sort: parseSortKeys(opts.sort),
      order: (() => {
        if (opts.order !== 'asc' && opts.order !== 'desc') {
          throw new Error(`Invalid order "${opts.order as string}". Allowed: asc, desc`)
        }
        return opts.order as SortOrder
      })(),
      maxScan: Number(opts.maxScan),
      cacheTtl: Number(opts.cacheTtl),
      noCache: !opts.cache,
      ascii: Boolean(opts.ascii),
      wide: Boolean(opts.wide),
    }
    await runPopularVideos(cfg)
  })
