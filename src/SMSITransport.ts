import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import * as WebSocket from 'ws'

export class SMSITransport extends EventEmitter {
  private handlers: Record<string, Function> = {}
  private subscriptions: Record<string, Record<string, Function[]>> = {}
  private requestRejections: Function[] = []

  constructor(private socket: WebSocket) {
    super()
    this.socket.on('error', err => this.emit('error', err))
    this.socket.on('open', () => this.emit('open'))
    this.socket.on('close', () => this.onClose())
    this.socket.on('message', message => this.onMessage(message))
  }

  get connected(): boolean {
    return this.socket.readyState === 1
  }

  async sendExec(service: string, method: string, params: any[]): Promise<any[]> {
    const type = 'exec'
    return this.sendRequest({ type, service, method, params })
  }

  async sendSpec(service: string): Promise<any> {
    const type = 'spec'
    return this.sendRequest({ type, service })
  }

  async sendSubscribe(service: string, event: string, handler: Function): Promise<void> {
    this.subscriptions[service] = this.subscriptions[service] || {}
    this.subscriptions[service][event] = this.subscriptions[service][event] || []
    this.subscriptions[service][event].push(handler)

    const type = 'subscribe'
    await this.sendRequest ({ type, service, event })
  }

  async sendUnsubscribe(service: string, event: string, handler?: Function): Promise<void> {
    if (!this.subscriptions[service]) return
    if (!this.subscriptions[service][event]) return
    if (handler) {
      this.subscriptions[service][event] = this.subscriptions[service][event].filter(fn => fn === handler)
    } else {
      delete this.subscriptions[service][event]
    }

    const type = 'unsubscribe'
    await this.sendRequest({ type, service, event })
  }

  sendResponse(id: string, response?: any): Promise<void> {
    const type = 'response'
    return this.send({ id, type, response })
  }

  sendEvent(service: string, event: string, params: any[]): Promise<void> {
    const type = 'event'
    return this.send({ type, service, event, params })
  }

  // send error
  sendError(error: any, id?: string): Promise<void> {
    if (!error || typeof error.toString !== 'function') error = 'Unknown error'
    if (error.message) error = error.message
    error = error.toString()
    const type = 'error'
    return this.send({ id, type, error })
  }

  async close(): Promise<void> {
    await new Promise<void>(resolve => {
      this.socket.on('close', () => resolve())
      this.socket.close()
    })
  }

  // private methods

  // send a message
  private send(data: any): Promise<void> {
    if (!this.connected) return Promise.reject('Not connected')
    const message = JSON.stringify(data)
    return new Promise((resolve, reject) => {
      this.socket.send(message, err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  // send a request
  private async sendRequest(data: any): Promise<any> {
    const id = uuid.v4()
    data.id = id
    await this.send(data)
    return new Promise<any>((resolve, reject) => {
      this.requestRejections.push(reject)
      this.handlers[id] = (err: string, response: any): void => {
        const i = this.requestRejections.indexOf(reject)
        this.requestRejections.splice(i, 1)
        err ? reject(err) : resolve(response)
        delete this.handlers[id]
      }
    })
  }

  private onMessage(data: WebSocket.Data): void {
    let message: any

    // parse message
    try {
      message = JSON.parse(data.toString())
    } catch (err) {
      this.sendError(`Invalid message: parse error`)
      return
    }

    // validate message
    const error = this.validateMessage(message)
    if (error) {
      this.sendError(`Invalid message: ${error}`)
      return
    }

    switch (message.type) {
    case 'response': {
      const handler = this.handlers[message.id]
      if (!handler) {
        this.sendError(`unknown id ${message.id}`)
        return
      }
      handler(null, message.response)
      return
    }
    case'event': {
      const { service, event } = message
      if (!this.subscriptions[service]) return
      if (!this.subscriptions[service][event]) return
      for (const handler of this.subscriptions[service][event]) {
        handler(...(message.params || []))
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
      if (message.id === undefined) return 'id missing'
      if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
      if (typeof message.event !== 'string' || message.event.length < 1) return 'event not a string'
      break
    default:
      return 'unknown type'
    }
  }

  // reject all outstanding requests
  private onClose(): void {
    this.emit('close')
    for (const reject of this.requestRejections) {
      reject('Connection closed')
    }
    this.requestRejections = []
  }

}
