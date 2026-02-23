import { Command } from 'commander'
import { runPopularVideos } from './service'
import { SortKey, SortOrder } from './types'

function parseSortKeys(value: string): SortKey[] {
  const allowed: SortKey[] = ['views', 'likes', 'comments']
  return value.split(',').map((k) => {
    const key = k.trim() as SortKey
    if (!allowed.includes(key)) {
      throw new Error(`Invalid sort key "${key}". Allowed: ${allowed.join(', ')}`)
    }
    return key
  })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .action(async (channel: string, opts: any) => {
    const cfg = {
      channel,
      limit: Number(opts.limit),
      sort: parseSortKeys(opts.sort),
      order: opts.order as SortOrder,
      maxScan: Number(opts.maxScan),
      cacheTtl: Number(opts.cacheTtl),
      noCache: !opts.cache,
      ascii: Boolean(opts.ascii),
      wide: Boolean(opts.wide),
    }
    await runPopularVideos(cfg)
  })
