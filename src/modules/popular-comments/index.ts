import { Command } from 'commander'
import { runPopularComments } from './service'

export const popularCommentsCommand = new Command('popular-comments')
  .description('Fetch popular comments for a video or channel')
  .command('video')
  .argument('<videoId>', 'YouTube video id')
  .option('-l, --limit <n>', 'number of comments to fetch', '50')
  .option('-s, --sort <mode>', 'sort mode: likes|time|replies|likes_plus_author', 'likes')
  .option('-o, --order <order>', 'asc|desc', 'desc')
  .option('--ascii', 'force ascii table', false)
  .option('--wide', 'wide output', false)
  .option('--author-bonus <n>', 'bonus for author replied', '1000')
  .action(async (videoId: string, opts: any) => {
    const cfg = {
      videoId,
      limit: Number(opts.limit),
      sort: opts.sort,
      order: opts.order,
      ascii: opts.ascii,
      wide: opts.wide,
      authorBonus: Number(opts.authorBonus),
    }
    await runPopularComments(cfg)
  })
