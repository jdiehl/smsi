import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { Transport } from './Transport'

export class Client extends EventEmitter {
  private transport?: Transport

  constructor(private url: string) {
    super()
  }

  async start() {
    const ws = new WebSocket(this.url)
    this.transport = new Transport(ws)
    this.transport.on('error', err => this.emit('error', err))
    this.transport.on('close', () => this.restart())
    await new Promise(resolve => {
      this.transport!.on('open', () => resolve())
    })
  }

  async stop() {
    if (this.transport) await this.transport.close()
  }

  async exec(service: string, method: string, params: any[] = []): Promise<any> {
    if (!this.transport) await this.start()
    return this.transport!.sendExec(service, method, params)
  }

  async subscribe(service: string, event: string, handler: (...params: any[]) => void): Promise<void> {
    if (!this.transport) await this.start()
    await this.transport!.sendSubscribe(service, event, handler)
  }

  async unsubscribe(service: string, event: string, handler: (...params: any[]) => void): Promise<void> {
    if (!this.transport) await this.start()
    await this.transport!.sendUnsubscribe(service, event, handler)
  }

  // private methods

  private restart() {
    // todo
  }
}
