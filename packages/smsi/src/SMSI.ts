import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { SMSIExposeOptions, SMSIServerOptions, SMSIService } from './interfaces'

export class SMSI extends EventEmitter {
  server?: WebSocket.Server

  private services: Record<string, SMSIService> = {}
  private constructors: any[] = []

  get address(): WebSocket.AddressInfo {
    if (!this.server) throw new Error(`Cannot get address: server not running`)
    return this.server.address() as WebSocket.AddressInfo
  }

  constructor(private options: SMSIServerOptions = {}) {
    super()
  }

  // expose a microservice
  expose(name: string, service: SMSIService, options: SMSIExposeOptions) {
    if (this.services[name]) throw new Error(`Cannot expose service: service with name ${name} exists already`)
    this.services[name] = service
    if (options.init) this.constructors.push(options.init)
  }

  // start the server and listen on the given port
  async start() {
    if (this.server) throw new Error(`Cannot start server: already running`)
    await this.init()
    await this.listen()
  }

  async stop() {
    if (!this.server) throw new Error(`Cannot stop server: not running`)
    return new Promise((resolve, reject) => {
      this.server!.close((err) => err ? reject(err) : resolve())
      this.server = undefined
    })
  }

  // private methods

  // initialize all services
  private async init() {
    await Promise.all(this.constructors.map(init => init()))
  }

  // start the server
  private async listen() {
    this.server = new WebSocket.Server(this.options)
    this.server!.on('connection', client => this.onConnection(client))
    this.server!.on('error', err => this.emit('error', err))
    return new Promise(resolve => this.server!.on('listening', () => resolve()))
  }

  private async onConnection(client: WebSocket): Promise<void> {
    const events: Record<string, Record<string, any[]>> = {}

    // error handling
    client.on('error', err => this.emit('error', err))

    // connection handling
    client.on('close', () => {
      for (const service of Object.keys(events)) {
        for (const event of Object.keys(events[service])) {
          for (const listener of events[service][event]) {
            this.services[service].off(event, listener)
          }
        }
      }
    })

    // message handling
    client.on('message', message => {

      // parse the message
      const command = this.parse(message)
      if (!command) return this.send(client, { error: `Invalid message: could not parse "${message}"` })

      // validate the command
      if (!this.validateCommand(command)) return this.send(client, { error: `Invalid message: unknown command` })

      // get the service
      const service = this.services[command.service]
      if (!service) return this.send(client, { error: `Invalid message: service ${command.service} does not exist` })

      const { event, method } = command
      if (event) {
        // subscribe to an event
        if (typeof service.on !== 'function' || typeof service.off !== 'function') {
          return this.send(client, { error: `Invalid message: service ${command.service} does not support events` })
        }
        const listener = (...params: any[]) => {
          this.send(client, { service: command.service, event, params })
        }
        events[command.service] = events[command.service] || {}
        events[command.service][event] = events[command.service][event] || []
        events[command.service][event].push(listener)
        service.on(event, listener)
      } else {
        // execute a method
        if (typeof service[method] !== 'function') return this.send(client, { error: `Invalid message: ${command.service}.${method} does not exist` })
        Promise.resolve(service[method].apply(service, command.params || [])).then(
          result => this.send(client, { service: command.service, method, result }),
          error => this.send(client, { service: command.service, method, error })
        )
      }

    })
  }

  // send a message
  private send(client: WebSocket, data: any) {
    client.send(JSON.stringify(data))
  }

  // parse a message
  private parse(message: WebSocket.Data): any {
    try {
      return JSON.parse(message.toString())
    } catch (err) {
      return
    }
  }

  // validate a command
  private validateCommand(cmd: any): boolean {
    if (typeof cmd !== 'object') return false
    if (typeof cmd.service !== 'string' || cmd.service.length < 1) return false
    if (cmd.method !== undefined) {
      // SMSICommandMethod
      if (typeof cmd.method !== 'string' || cmd.method.length < 1) return false
      if (cmd.params && !(cmd.params instanceof Array)) return false
    } else if (cmd.event !== undefined) {
      // SMSICommandEvent
      if (typeof cmd.event !== 'string' || cmd.event.length < 1) return false
    } else {
      return false
    }
    return true
  }

}
