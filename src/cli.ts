#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { popularCommentsCommand } from './modules/popular-comments'
import { popularVideosCommand } from './modules/popular-videos'
import { subtitlesCommand } from './modules/subtitles'

const program = new Command()
program.name('youtools').description('YouTube utilities CLI').version('0.1.0')

program.addCommand(popularCommentsCommand)
program.addCommand(popularVideosCommand)
program.addCommand(subtitlesCommand)

// When running via `pnpm dev -- <args>`, ts-node passes the `--` sentinel
// literally in process.argv. Strip it so Commander sees clean arguments.
const argv = process.argv.filter((arg, i) => !(i >= 2 && arg === '--'))

program.parseAsync(argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
