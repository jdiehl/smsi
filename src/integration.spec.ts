import { EventEmitter } from 'events'
import { SMSIClient, SMSIServer } from '..'

let s1: any
let s2: any
let server: SMSIServer
let client: SMSIClient

async function wait(delay = 10): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, delay))
}

beforeEach(async () => {
  s1 = new EventEmitter()
  s1.m1 = jest.fn().mockReturnValue('ok')
  s1.m2 = jest.fn().mockResolvedValue({ foo: 'bar' })
  s2 = new EventEmitter()
  s2.foo = jest.fn()
  server = new SMSIServer({ port: 9999 })
  server.expose('s1', s1)
  server.expose('s2', s2)
  client = new SMSIClient('ws://127.0.0.1:9999')
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
  await client.subscribe('s1', 'e1', handler)
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(1)
})

test('should pass params to the event handler', async () => {
  const handler = jest.fn()
  await client.subscribe('s1', 'e1', handler)
  s1.emit('e1', 1, 'a', { foo: 'bar' })
  await wait()
  expect(handler).toHaveBeenCalledTimes(1)
  expect(handler).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})

test('should forward multiple events', async () => {
  const handler = jest.fn()
  await client.subscribe('s1', 'e1', handler)
  s1.emit('e1')
  s1.emit('e1')
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(3)
})

test('should stop forwarding events', async () => {
  const handler = jest.fn()
  await client.subscribe('s1', 'e1', handler)
  await client.unsubscribe('s1', 'e1', handler)
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(0)
})

test('should report a missing service', async () => {
  await expect(client.exec('nope', 'foo')).rejects.toBe('Invalid service: nope')
})

test('should report a missing method', async () => {
  await expect(client.exec('s1', 'foo')).rejects.toBe('Invalid method: s1.foo')
})

test('should forward an rejection as an error', async () => {
  s1.m1.mockRejectedValue('rejected')
  await expect(client.exec('s1', 'm1')).rejects.toBe('rejected')
})

test('should forward an exception as an error', async () => {
  s1.m1.mockImplementation(() => { throw new Error('thrown') })
  await expect(client.exec('s1', 'm1')).rejects.toBe('thrown')
})

test('should create a proxy', async () => {
  const proxy = await client.makeProxy('s1')
  expect(Object.keys(proxy)).toEqual(['m1', 'm2', 'on', 'off'])
  expect(typeof proxy.m2).toBe('function')
  expect(typeof proxy.m1).toBe('function')
})

test('should execute a method via the proxy', async () => {
  const proxy = await client.makeProxy('s1')
  const res = await proxy.m1()
  expect(res).toBe('ok')
  expect(s1.m1).toHaveBeenCalledTimes(1)
})

test('should execute a method with params via the proxy', async () => {
  const proxy = await client.makeProxy('s1')
  const res = await proxy.m2(1, 'a', { foo: 'bar' })
  expect(res).toEqual({ foo: 'bar' })
  expect(s1.m2).toHaveBeenCalledTimes(1)
  expect(s1.m2).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})

test('should forward events to the proxy', async () => {
  const proxy = await client.makeProxy('s1')
  const handler = jest.fn()
  await proxy.on('e1', handler)
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(1)
})

test('should stop forwarding events to the proxy', async () => {
  const proxy = await client.makeProxy('s1')
  const handler = jest.fn()
  await proxy.on('e1', handler)
  await proxy.off('e1', handler)
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(0)
})

test('should remove all listeners upon disconnecting', async () => {
  const handler = jest.fn()
  await client.subscribe('s1', 'e1', handler)
  await client.stop()
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(0)
})

test('should remove all listeners when disconnected', async () => {
  const handler = jest.fn()
  await client.subscribe('s1', 'e1', handler)
  await client.stop()
  await wait()
  s1.emit('e1')
  await wait()
  expect(handler).toHaveBeenCalledTimes(0)
})
