export type SMSIService = any

export interface SMSIExposeOptions {
  init?(): void | Promise<void>
}

export interface SMSIServerOptions {
  port?: number
  hostname?: number
}

export interface SMSICommand {
  service: string
  method: string
  params: any[]
}
