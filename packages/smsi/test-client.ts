import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { Client } from './index'

let client: Client

async function main() {
  // const ws = new WebSocket('ws://127.0.0.1:9999')
  // await new Promise(resolve => {
  //   ws.on('open', () => {
  //     console.log('open')
  //     resolve()
  //   })
  // })

  client = new Client('ws://127.0.0.1:9999')
  client.on('error', err => console.error('Error', err))
  await client.start()
  console.log('client started')

  const res = await client.exec('s1', 'm1')
  console.log(res)

  await client.stop()
  console.log('client stopped')
}

main().then(() => console.log('done'), err => console.error('Error', err))
