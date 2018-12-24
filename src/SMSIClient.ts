import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { SMSITransport } from './SMSITransport'

export class SMSIClient extends EventEmitter {
  private transport?: SMSITransport

  constructor(private url: string) {
    super()
  }

  async start(): Promise<void> {
    const ws = new WebSocket(this.url)
    this.transport = new SMSITransport(ws)
    this.transport.on('error', err => this.emit('error', err))
    this.transport.on('close', () => this.restart())
    await new Promise<void>(resolve => {
      this.transport!.on('open', () => resolve())
    })
  }

  async stop(): Promise<void> {
    if (this.transport) await this.transport.close()
  }

  async exec(service: string, method: string, params: any[] = []): Promise<any> {
    if (!this.transport) await this.start()
    return this.transport!.sendExec(service, method, params)
  }

  async subscribe(service: string, event: string, handler: Function): Promise<void> {
    if (!this.transport) await this.start()
    this.transport!.sendSubscribe(service, event, handler)
  }

  async unsubscribe(service: string, event: string, handler: Function): Promise<void> {
    if (!this.transport) await this.start()
    this.transport!.sendUnsubscribe(service, event, handler)
  }

  async makeProxy<T = any>(service: string): Promise<T> {
    if (!this.transport) await this.start()

    // query the spec
    const spec = await this.transport!.sendSpec(service)

    // construct the proxy object
    const proxy: any = {}

    // methods
    for (const method of spec) {
      proxy[method] = async (...params: any[]) => this.exec(service, method, params)
    }

    // events
    proxy.on = (event: string, handler: Function) => this.subscribe(service, event, handler)
    proxy.off = (event: string, handler: Function) => this.unsubscribe(service, event, handler)

    return proxy
  }

  // private methods

  private async restart(): Promise<void> {
    // todo
  }
}
