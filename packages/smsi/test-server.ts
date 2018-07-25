import { EventEmitter } from 'events'
import { Server } from './index'

let s1: any
let s2: any
let server: Server

async function main() {
  s1 = new EventEmitter()
  s2 = new EventEmitter()
  server = new Server({ port: 9999 })
  server.expose('s1', s1)
  server.expose('s2', s2)
  server.on('error', err => console.error('Error', err))
  await server.start()

  console.log('server started')
}

main().then(() => console.log('done'), err => console.error('Error', err))
