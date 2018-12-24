export type SMSIService = any

export interface SMSIExposeOptions {
  init?(): void | Promise<void>
  deinit?(): void | Promise<void>
}

export interface SMSIServerOptions {
  port?: number
  hostname?: number
}
