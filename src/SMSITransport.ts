import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import * as WebSocket from 'ws'

export class SMSITransport extends EventEmitter {
  private handlers: Record<string, Function> = {}
  private subscriptions: Record<string, Record<string, Function[]>> = {}

  constructor(private socket: WebSocket) {
    super()
    this.socket.on('error', err => this.emit('error', err))
    this.socket.on('open', () => this.emit('open'))
    this.socket.on('close', () => this.emit('close'))
    this.socket.on('message', message => this.onMessage(message))
  }

  async sendExec(service: string, method: string, params: any[]): Promise<any[]> {
    const type = 'exec'
    return this.sendRequest({ type, service, method, params })
  }

  async sendSpec(service: string): Promise<string[]> {
    const type = 'spec'
    return this.sendRequest({ type, service })
  }

  sendSubscribe(service: string, event: string, handler: Function): void {
    this.subscriptions[service] = this.subscriptions[service] || {}
    this.subscriptions[service][event] = this.subscriptions[service][event] || []
    this.subscriptions[service][event].push(handler)

    const type = 'subscribe'
    this.send({ type, service, event })
  }

  sendUnsubscribe(service: string, event: string, handler?: Function): void {
    if (!this.subscriptions[service]) return
    if (!this.subscriptions[service][event]) return
    if (handler) {
      this.subscriptions[service][event] = this.subscriptions[service][event].filter(fn => fn === handler)
    } else {
      delete this.subscriptions[service][event]
    }

    const type = 'unsubscribe'
    this.send({ type, service, event })
  }

  sendResponse(id: string, response: any): void {
    const type = 'response'
    this.send({ id, type, response })
  }

  sendEvent(service: string, event: string, params: any[]): void {
    const type = 'event'
    this.send({ type, service, event, params })
  }

  // send error
  sendError(error: any, id?: string): void {
    const type = 'error'
    this.send({ id, type, error })
  }

  async close(): Promise<void> {
    await new Promise<void>(resolve => {
      this.socket.on('close', () => resolve())
      this.socket.close()
    })
  }

  // private methods

  // send a message
  private send(data: any): void {
    const message = JSON.stringify(data)
    this.socket.send(message)
  }

  // send a request
  private async sendRequest(data: any): Promise<any> {
    const id = this.makeId()
    data.id = id
    this.send(data)
    return new Promise<any>((resolve, reject) => {
      this.handlers[id] = (err: string, response: any) => {
        err ? reject(err) : resolve(response)
        delete this.handlers[id]
      }
    })
  }

  private makeId(): string {
    return uuid()
  }

  private findIdForHandler(handler: () => void): string | undefined {
    for (const id of Object.keys(this.handlers)) {
      if (this.handlers[id] === handler) return id
    }
  }

  private onMessage(data: WebSocket.Data): void {
    let message: any

    // parse message
    try {
      message = JSON.parse(data.toString())
    } catch (err) {
      return this.sendError(`Invalid message: parse error`)
    }

    // validate message
    const error = this.validateMessage(message)
    if (error) return this.sendError(`Invalid message: ${error}`)

    switch (message.type) {
    case 'response': {
      const handler = this.handlers[message.id]
      if (!handler) return this.sendError(`unknown id ${message.id}`)
      handler(null, message.response)
      return
    }
    case'event': {
      const { service, event } = message
      if (!this.subscriptions[service]) return
      if (!this.subscriptions[service][event]) return
      for (const handler of this.subscriptions[service][event]) {
        handler.apply(null, message.params || [])
      }
      return
    }
    case 'error': {
      if (message.id) {
        this.handlers[message.id](message.error)
      } else {
        this.emit('error', message.error)
      }
      return
    }
    default:
      this.emit(message.type, message)
    }

  }

  private validateMessage(message: any): string | undefined {
    if (typeof message !== 'object') return 'not an object'
    if (typeof message.type !== 'string') return 'type not a string'
    switch (message.type) {
    case 'spec':
      if (message.id === undefined) return 'id missing'
      if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
      break
    case 'error':
      if (typeof message.error !== 'string') return 'error not a string'
      break
    case 'response':
      if (message.id === undefined) return 'id missing'
      break
    case 'event':
      if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
      if (typeof message.event !== 'string' || message.event.length < 1) return 'event not a string'
      if (message.params && !(message.params instanceof Array)) return 'params not an array'
      break
    case 'exec':
      if (message.id === undefined) return 'id missing'
      if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
      if (typeof message.method !== 'string' || message.method.length < 1) return 'method not a string'
      if (message.params && !(message.params instanceof Array)) return 'params not an array'
      break
    case 'subscribe':
    case 'unsubscribe':
      if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
      if (typeof message.event !== 'string' || message.event.length < 1) return 'event not a string'
      break
    default:
      return 'unknown type'
    }
  }

}
