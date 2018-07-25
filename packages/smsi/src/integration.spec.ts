import { EventEmitter } from 'events'
import { Client, Server, SMSIExposeOptions, SMSIServerOptions } from '..'

let s1: any
let s2: any
let server: Server
let client: Client

async function wait(delay = 10): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, delay))
}

beforeEach(async () => {
  s1 = new EventEmitter()
  s1.m1 = jest.fn().mockReturnValue('ok')
  s1.m2 = jest.fn().mockResolvedValue({ foo: 'bar' })
  s2 = new EventEmitter()
  s2.foo = jest.fn()
  server = new Server({ port: 9999 })
  server.expose('s1', s1)
  server.expose('s2', s2)
  client = new Client('ws://127.0.0.1:9999')
  await server.start()
  await client.start()
})

afterEach(async () => {
  await server.stop()
  await client.stop()
})

test('should execute a remote method', async () => {
  const res = await client.exec('s1', 'm1')
  expect(res).toBe('ok')
  expect(s1.m1).toHaveBeenCalledTimes(1)
})

test('should execute a remote method with params', async () => {
  const res = await client.exec('s1', 'm1', [1, 'a', { foo: 'bar' }])
  expect(res).toBe('ok')
  expect(s1.m1).toHaveBeenCalledTimes(1)
  expect(s1.m1).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})

test('should resolve a remote promise', async () => {
  const res = await client.exec('s1', 'm2')
  expect(res).toEqual({ foo: 'bar' })
  expect(s1.m2).toHaveBeenCalledTimes(1)
})

test('should execute a method on the second service', async () => {
  await client.exec('s2', 'foo')
  expect(s2.foo).toHaveBeenCalledTimes(1)
})

test('should forward events', async () => {
  const handler = jest.fn()
  client.subscribe('s1', 'e1', handler)
  await wait()
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(1)
})

test('should pass params to the event handler', async () => {
  const handler = jest.fn()
  client.subscribe('s1', 'e1', handler)
  await wait()
  s1.emit('e1', 1, 'a', { foo: 'bar' })
  await wait()
  expect(handler).toHaveBeenCalledTimes(1)
  expect(handler).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})

test('should forward multiple events', async () => {
  const handler = jest.fn()
  client.subscribe('s1', 'e1', handler)
  await wait()
  s1.emit('e1')
  s1.emit('e1')
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(3)
})
