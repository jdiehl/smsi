export type SMSIService = any

export interface SMSIExposeOptions {
  init?(): void | Promise<void>
}

export interface SMSIServerOptions {
  port?: number
  hostname?: number
}

export type SMSICommand = SMSICommandMethod | SMSICommandEvent

export interface SMSICommandMethod {
  service: string
  method: string
  params: any[]
}

export interface SMSICommandEvent {
  service: string
  event: string
}
