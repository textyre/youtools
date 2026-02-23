import { Command } from 'commander'
import { runPopularComments } from './service'

interface PopularCommentsOpts {
  limit: string
  sort: string
  order: string
  ascii: boolean
  wide: boolean
  expand: boolean
  pager: boolean
  scanReplies: boolean
  authorBonus: string
}

export const popularCommentsCommand = new Command('popular-comments')
  .description('Fetch popular comments for a video or channel')
  .command('video')
  .argument('<videoId>', 'YouTube video id')
  .option('-l, --limit <n>', 'number of comments to fetch', '50')
  .option('-s, --sort <mode>', 'sort mode: likes|time|replies|likes_plus_author', 'likes')
  .option('-s, --sort <mode>', 'sort mode: likes|time|replies|likes_plus_author|length', 'likes')
  .option('-o, --order <order>', 'asc|desc', 'desc')
  .option('--ascii', 'force ascii table', false)
  .option('--wide', 'wide output', false)
  .option('--expand', 'print comments fully (alias of --wide)', true)
  .option('--pager', 'open selected comment in pager (less/more) when expanding interactively', false)
  .option('--scan-replies', 'fetch all replies to detect author replies (uses extra API requests)', true)
  .option('--author-bonus <n>', 'bonus for author replied', '1000')
  .action(async (videoId: string, opts: PopularCommentsOpts) => {
    const cfg = {
      videoId,
      limit: Number(opts.limit),
      sort: opts.sort,
      order: opts.order,
      ascii: opts.ascii,
      wide: opts.wide || opts.expand,
      pager: Boolean(opts.pager),
      scanReplies: Boolean(opts.scanReplies),
      authorBonus: Number(opts.authorBonus),
    }
    await runPopularComments(cfg)
  })
