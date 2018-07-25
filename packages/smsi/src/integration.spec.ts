import { EventEmitter } from 'events'
import { Client, Server, SMSIExposeOptions, SMSIServerOptions } from '..'

let s1: any
let s2: any
let server: Server
let client: Client

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
  console.log('test start')
  // const res = await client.exec('s1', 'm1')
  // expect(res).toBe('ok')
  // expect(s1.m1).toHaveBeenCalledTimes(1)
})
