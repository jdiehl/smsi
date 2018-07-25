import { SMSIExposeOptions } from './interfaces'

export class ExposedService {

  constructor(private service: any, private options: SMSIExposeOptions) {}

  async init(): Promise<void> {
    if (this.options.init) await this.options.init()
  }

  async deinit(): Promise<void> {
    if (this.options.deinit) await this.options.deinit()
  }

  async run(method: string, params: any[] = []): Promise<void> {
    return Promise.resolve(this.service[method].apply(this.service, params))
  }

  on(event: string, handler: () => void) {
    this.service.on(event, handler)
  }

  off(event: string, handler?: () => void) {
    this.service.off(event, handler)
  }

  hasMethod(method: string): boolean {
    return this.service.hasOwnProperty(method)
  }

  isEventEmitter(): boolean {
    return (typeof this.service.on === 'function' && typeof this.service.off === 'function')
  }

}