#!/usr/bin/env node
import { Command } from 'commander'
import { popularCommentsCommand } from './modules/popular-comments'

const program = new Command()
program.name('youtools').description('YouTube utilities CLI').version('0.1.0')

program.addCommand(popularCommentsCommand)

program.parseAsync(process.argv).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
