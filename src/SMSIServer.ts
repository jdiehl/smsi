import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { SMSIExposedService } from './SMSIExposedService'
import { SMSIExposeOptions, SMSIServerOptions } from './interfaces'
import { SMSITransport } from './SMSITransport'

export class SMSIServer extends EventEmitter {
  server?: WebSocket.Server

  private services: Record<string, SMSIExposedService> = {}

  get address(): WebSocket.AddressInfo {
    if (!this.server) throw new Error(`Cannot get address: server not running`)
    return this.server.address() as WebSocket.AddressInfo
  }

  constructor(private options: SMSIServerOptions = {}) {
    super()
  }

  // expose a microservice
  expose(name: string, service: any, options: SMSIExposeOptions = {}): void {
    if (this.services[name]) throw new Error(`Cannot expose service: service with name ${name} exists already`)
    this.services[name] = new SMSIExposedService(service, options)
  }

  // start the server and listen on the given port
  async start(): Promise<void> {
    if (this.server) throw new Error(`Cannot start server: already running`)

    // initialize services
    await Promise.all(Object.keys(this.services).map(service => this.services[service].init()))

    // start server
    this.server = new WebSocket.Server(this.options)
    this.server!.on('connection', connection => this.onConnection(connection))
    this.server!.on('error', err => this.emit('error', err))
    await new Promise<void>(resolve => this.server!.on('listening', () => resolve()))
  }

  async stop(): Promise<void> {
    if (!this.server) throw new Error(`Cannot stop server: not running`)

    // stop server
    await new Promise<void>((resolve, reject) => this.server!.close((err) => err ? reject(err) : resolve()))
    this.server = undefined

    // deinitialize services
    await Promise.all(Object.keys(this.services).map(service => this.services[service].deinit()))
  }

  // private methods

  private async onConnection(connection: WebSocket): Promise<void> {
    const transport = new SMSITransport(connection)
    const handlers: Record<string, Record<string, Function>> = {}

    // error handling
    transport.on('error', err => this.emit('error', err))

    // send the spec
    transport.on('spec', async ({ id, service }) => {
      if (!this.services[service]) return transport.sendError(`Invalid service: ${service}`, id)
      transport.sendResponse(id, this.services[service].spec())
    })

    // execute a method
    transport.on('exec', async ({ id, service, method, params }) => {
      if (!this.services[service]) return transport.sendError(`Invalid service: ${service}`, id)
      if (!this.services[service].hasMethod(method)) return transport.sendError(`Invalid method: ${service}.${method}`, id)
      let res
      try {
        res = await this.services[service].run(method, params)
      } catch (err) {
        return transport.sendError(err instanceof Error ? err.message : err.toString(), id)
      }
      transport.sendResponse(id, res)
    })

    // subscribe to events
    transport.on('subscribe', async ({ service, event }) => {
      if (!this.services[service]) return transport.sendError(`Invalid service: ${service}`)
      this.services[service].on(event, (...params: any[]) => {
        transport.sendEvent(service, event, params)
      })
    })

    // unsubscribe from events
    transport.on('unsubscribe', async ({ id, service, event }) => {
      this.services[service].off(event)
    })

  }
}
