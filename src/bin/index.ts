#!/usr/bin/env node

import * as yargs from 'yargs';

yargs
  .usage('$0 <cmd> [args]')
  .commandDir('./commands', { extensions: ['js', 'ts'], exclude: /.d.ts$/ })
  .showHelpOnFail(true)
  .demandCommand()
  .help().parse();
