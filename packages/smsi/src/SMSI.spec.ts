import * as WebSocket from 'ws'
import { SMSIExposeOptions, SMSIServerOptions } from './interfaces'
import { SMSI } from './SMSI'

let smsi: SMSI
let ws: WebSocket

afterEach(async () => {
  if (smsi && smsi.server) await smsi.stop()
})

// convenience function to start a microservice
async function start(service: any, exposeOpt: SMSIExposeOptions = {}, serverOpt: SMSIServerOptions = { port: 9999 }): Promise<SMSI> {
  smsi = new SMSI(serverOpt)
  smsi.expose('test', service, exposeOpt)
  await smsi.start()
  return smsi
}

async function connect(): Promise<WebSocket> {
  return new Promise<WebSocket>(resolve => {
    ws = new WebSocket(`ws://127.0.0.1:${smsi.address.port}`)
    ws.on('open', () => resolve(ws))
  })
}

async function sendCommand(command: any) {
  return new Promise(resolve => {
    const handler = response => {
      ws.off('message', handler)
      resolve(JSON.parse(response))
    }
    ws.on('message', handler)
    ws.send(JSON.stringify(command))
  })
}

test('should use given port', async () => {
  await start({}, {}, { port: 8888 })
  expect(smsi.address.port).toBe(8888)
})

test('should call init', async () => {
  const init = jest.fn()
  await start({}, { init })
  expect(init).toHaveBeenCalledTimes(1)
})

test('should expose a method', async () => {
  const hello = jest.fn().mockResolvedValue('ok')
  await start({ hello })
  await connect()
  const res = await sendCommand({ service: 'test', method: 'hello' })
  expect(hello).toHaveBeenCalledTimes(1)
  expect(res).toEqual({ service: 'test', method: 'hello', result: 'ok' })
})

test('should pass params to a method', async () => {
  const hello = jest.fn()
  await start({ hello })
  await connect()
  const res = await sendCommand({ service: 'test', method: 'hello', params: [1, 'a', { foo: 'bar' }] })
  expect(hello).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})
