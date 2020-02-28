import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { SMSIServerOptions } from './interfaces'
import { SMSITransport } from './SMSITransport'
import { isEventEmitter } from './util'

export class SMSIServer extends EventEmitter {

  get address(): WebSocket.AddressInfo {
    if (!this.server) throw new Error(`Cannot get address: server not running`)
    return this.server.address() as WebSocket.AddressInfo
  }
  server?: WebSocket.Server

  private services: Record<string, any> = {}

  constructor(private options: SMSIServerOptions = {}) {
    super()
  }

  // expose a microservice
  expose(name: string, service: any): void {
    if (this.services[name]) throw new Error(`Cannot expose service: service with name ${name} exists already`)
    this.services[name] = service
  }

  // start the server and listen on the given port
  async start(): Promise<void> {
    if (this.server) return

    // start server
    await new Promise<void>(resolve => {
      this.server = new WebSocket.Server(this.options)
      this.server.on('connection', connection => this.onConnection(connection))
      this.server.on('error', err => this.emit('error', err))
      this.server.on('listening', () => resolve())
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return

    // stop server
    await new Promise<void>((resolve, reject) => this.server!.close((err) => err ? reject(err) : resolve()))
    this.server = undefined
  }

  // private methods

  private async onConnection(connection: WebSocket): Promise<void> {
    const transport = new SMSITransport(connection)
    let handlers: Record<string, Record<string, Function>> = {}

    // error handling
    transport.on('error', err => this.emit('error', err))

    // remove all event handlers
    transport.on('close', () => {
      for (const service of Object.keys(handlers)) {
        for (const event of Object.keys(handlers[service])) {
          this.services[service].off(event, handlers[service][event])
        }
      }
      handlers = {}
    })

    // send the spec
    transport.on('spec', async ({ id, service }) => {
      try {
        const spec = this.serviceSpec(service)
        transport.sendResponse(id, spec)
      } catch (err) {
        transport.sendError(err, id)
      }
    })

    // execute a method
    transport.on('exec', async ({ id, service, method, params }) => {
      try {
        const res = await this.serviceExec(service, method, params)
        transport.sendResponse(id, res)
      } catch (err) {
        transport.sendError(err, id)
      }
    })

    // subscribe to events
    transport.on('subscribe', async ({ id, service, event }) => {
      const s = this.services[service]
      if (!isEventEmitter(s)) return transport.sendError(`Invalid service or service does not support events: ${service}`, id)
      if (!handlers[service]) handlers[service] = {}
      if (handlers[service][event]) return transport.sendError(`Already subscribed to event: ${service}#${event}`, id)

      handlers[service][event] = (...params: any[]): void => {
        if (transport.connected) transport.sendEvent(service, event, params)
      }
      s.on(event, handlers[service][event])
      transport.sendResponse(id)
    })

    // unsubscribe from events
    transport.on('unsubscribe', async ({ id, service, event }) => {
      const s = this.services[service]
      if (!isEventEmitter(s)) return transport.sendError(`Invalid service or service does not support events: ${service}`, id)
      if (!handlers[service] || !handlers[service][event]) return transport.sendError(`Not subscribed to event: ${service}#${event}`, id)

      s.off(event, handlers[service][event])
      delete handlers[service][event]
      transport.sendResponse(id)
    })

  }

  private serviceSpec(name: string): any {
    const service = this.services[name]
    if (!service) throw new Error(`Invalid service: ${name}`)
    const methods = Object.keys(service).filter(key => typeof service[key] === 'function')
    const events = isEventEmitter(service)
    return { methods, events }
  }

  private async serviceExec(name: string, method: string, params: any[]): Promise<any> {
    const service = this.services[name]
    if (!service) throw new Error(`Invalid service: ${name}`)
    if (typeof service[method] !== 'function') throw new Error(`Invalid method: ${name}.${method}`)
    return await service[method](...params)
  }

}
