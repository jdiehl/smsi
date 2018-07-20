import { post } from 'got'
import { SMSIExposeOptions, SMSIServerOptions } from './interfaces'
import { SMSI } from './SMSI'

let smsi: SMSI

afterEach(async () => {
  if (smsi && smsi.server) await smsi.stop()
})

// convenience function to start a microservice
async function start(service: any, exposeOpt: SMSIExposeOptions = {}, serverOpt: SMSIServerOptions = {}): Promise<SMSI> {
  smsi = new SMSI(serverOpt)
  smsi.expose('test', service, exposeOpt)
  await smsi.start()
  return smsi
}

test('should use given port', async () => {
  await start({}, {}, { port: 9999 })
  expect(smsi.address.port).toBe(9999)
})

test('should call init', async () => {
  const init = jest.fn()
  await start({}, { init })
  expect(init).toHaveBeenCalledTimes(1)
})

test('should expose a method', async () => {
  const hello = jest.fn().mockResolvedValue('ok')
  await start({ hello })
  const body = { service: 'test', method: 'hello' }
  const res = await post(`http://127.0.0.1:${smsi.address.port}`, { body, json: true })
  expect(hello).toHaveBeenCalledTimes(1)
  expect(res.body).toBe('ok')
})

test('should pass params to a method', async () => {
  const hello = jest.fn()
  await start({ hello })
  const body = { service: 'test', method: 'hello', params: [1, 'a', { foo: 'bar' }] }
  await post(`http://127.0.0.1:${smsi.address.port}`, { body, json: true })
  expect(hello).toHaveBeenCalledWith(1, 'a', { foo: 'bar' })
})
