import * as execa from 'execa'
import { fs } from 'mz'
import * as process from 'process'
import { Flags } from './interfaces'

async function exec(cmd: string, ...args: string[]) {
  console.log(cmd, ...args)
  return execa(cmd, args, { stdio: 'inherit' })
}

export async function init([name]: [string], flags: Flags) {
  await fs.mkdir(name)
  await process.chdir(name)
  await exec('npm', 'init', '-y')
  await exec('yarn', 'add', '-D', 'ts-node')
  await exec('git', 'init')
}
