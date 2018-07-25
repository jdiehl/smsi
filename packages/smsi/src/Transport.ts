import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import * as WebSocket from 'ws'
import { ExposedService } from './ExposedService'

export class Transport extends EventEmitter {
  private handlers: Record<string, (...params: any[]) => void> = {}

  constructor(private socket: WebSocket) {
    super()
    this.socket.on('error', err => this.emit('error', err))
    this.socket.on('open', () => this.emit('open'))
    this.socket.on('close', () => this.emit('close'))
    this.socket.on('message', message => this.onMessage(message))
  }

  async sendExec(service: string, method: string, params: any[]): Promise<any[]> {
    const id = this.makeId()
    const type = 'exec'
    this.send({ id, type, service, method, params })
    return new Promise<any[]>((resolve, reject) => {
      this.handlers[id] = (err: string, response: any) => {
        err ? reject(err) : resolve(response)
        delete this.handlers[id]
      }
    })
  }

  sendSubscribe(service: string, event: string, handler: () => void): void {
    const id = this.makeId()
    const type = 'subscribe'
    this.send({ id, type, service, event })
    this.handlers[id] = handler
  }

  sendUnsubscribe(service: string, event: string, handler: () => void): void {
    const id = this.findIdForHandler(handler)
    if (!id) return
    const type = 'unsubscribe'
    this.send({ id, type, service, event })
    delete this.handlers[id]
  }

  sendResponse(id: string, response: any) {
    const type = 'response'
    const params = [response]
    this.send({ id, type, params })
  }

  sendEvent(id: string, params: any[]) {
    const type = 'response'
    this.send({ id, type, params })
  }

  // send error
  sendError(error: any, id?: string) {
    this.send({ error, id })
  }

  async close() {
    return new Promise(resolve => {
      this.socket.on('close', () => resolve())
      this.socket.close()
    })
  }

  // private methods

  // send a message
  private send(data: any) {
    console.log('SEND', data)
    const message = JSON.stringify(data)
    this.socket.send(message)
  }

  private makeId(): string {
    return uuid()
  }

  private findIdForHandler(handler: () => void): string | undefined {
    for (const id of Object.keys(this.handlers)) {
      if (this.handlers[id] === handler) return id
    }
  }

  private onMessage(data: WebSocket.Data) {
    console.log('RECV', data)
    let message: any

    // parse message
    try {
      message = JSON.parse(data.toString())
    } catch (err) {
      return this.sendError(`Invalid message: parse error`)
    }

    // error handling
    if (message.error) {
      if (message.id) return this.handlers[message.id](message.error)
      return this.emit('error', message.error)
    }

    // validate message
    const error = this.validateMessage(message)
    if (error) return this.sendError(`Invalid message: ${error}`)

    if (message.type === 'response') {
      const handler = this.handlers[message.id]
      if (!handler) return this.sendError(`unknown id ${message.id}`)
      handler(null, message.params)
    } else {
      this.emit(message.type, message)
    }
  }

  private validateMessage(message: any): string | undefined {
    if (typeof message !== 'object') return 'not an object'
    if (message.id === undefined) return 'id missing'
    if (typeof message.type !== 'string') return 'type not a string'
    if (typeof message.service !== 'string' || message.service.length < 1) return 'service not a string'
    switch (message.type) {
      case 'response':
        if (message.params && !(message.params instanceof Array)) return 'params not an array'
        break
      case 'exec':
        if (typeof message.method !== 'string' || message.method.length < 1) return 'method not a string'
        if (message.params && !(message.params instanceof Array)) return 'params not an array'
        break
      case 'subscribe':
      case 'unsubscribe':
        if (typeof message.event !== 'string' || message.event.length < 1) return 'event not a string'
        break
      default:
        return 'unknown type'
    }
  }

}
