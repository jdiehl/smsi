import { EventEmitter } from 'events'
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

test('should call a method', async () => {
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

test('should trigger on an event', async () => {
  const service = new EventEmitter()
  await start(service)
  await connect()
  return new Promise(resolve => {
    ws.on('message', msg => {
      expect(JSON.parse(msg.toString())).toEqual({ service: 'test', event: 'world', params: [] })
      resolve()
    })
    ws.send(JSON.stringify({ service: 'test', event: 'world' }))
    setTimeout(() => service.emit('world'), 10)
  })
})

test('should trigger on each event', async () => {
  const service = new EventEmitter()
  await start(service)
  await connect()
  return new Promise(resolve => {
    let count = 0
    ws.on('message', msg => {
      if (++count === 3) resolve()
    })
    ws.send(JSON.stringify({ service: 'test', event: 'world' }))
    setTimeout(() => service.emit('world'), 10)
    setTimeout(() => service.emit('world'), 11)
    setTimeout(() => service.emit('world'), 12)
  })
})

test('should trigger on an event with params', async () => {
  const service = new EventEmitter()
  await start(service)
  await connect()
  return new Promise(resolve => {
    ws.on('message', msg => {
      expect(JSON.parse(msg.toString())).toEqual({ service: 'test', event: 'world', params: ['a', { foo: 'bar' }] })
      resolve()
    })
    ws.send(JSON.stringify({ service: 'test', event: 'world' }))
    setTimeout(() => service.emit('world', 'a', { foo: 'bar' }), 10)
  })
})
