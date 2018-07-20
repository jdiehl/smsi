import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { SMSICommand, SMSIExposeOptions, SMSIServerOptions, SMSIService } from './interfaces'

export class SMSI {
  server?: Server

  private services: Record<string, SMSIService> = {}
  private constructors: any[] = []

  get address(): AddressInfo {
    if (!this.server) throw new Error(`Cannot get address: server not running`)
    return this.server.address() as AddressInfo
  }

  constructor(private options: SMSIServerOptions = {}) {}

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
    this.server!.close()
    this.server = undefined
  }

  // private methods

  // initialize all services
  private async init() {
    await Promise.all(this.constructors.map(init => init()))
  }

  // start the server
  private async listen() {
    this.server = createServer((req, res) => this.handleRequest(req, res))
    return new Promise(resolve => this.server!.listen(this.options.port, this.options.hostname, resolve))
  }

  // handle a request
  private handleRequest(req: IncomingMessage, res: ServerResponse) {

    // fetch and parse the command body
    const buf: any[] = []
    req.on('data', chunk => buf.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(buf).toString()
      let cmd: any
      try {
        cmd = JSON.parse(body)
      } catch (err) {
        res.statusCode = 400
        res.write(`Could not parse command`)
        res.end()
        return
      }

      // validate the command
      if (!this.validateCommand(cmd)) {
        res.statusCode = 400
        res.write(`Invalid command`)
        res.end()
        return
      }

      // execute the command and return its result
      this.executeCommand(cmd)
      .then(result => {
        try {
          if (result) res.write(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.write(`Service returned invalid result`)
        }
        res.end()
      }, err => {
        res.statusCode = 500
        res.write(err.toString())
        res.end()
      })
    })
  }

  // validate a command
  private validateCommand(cmd: any): boolean {
    if (typeof cmd !== 'object') return false
    if (typeof cmd.service !== 'string' || cmd.service.length < 1) return false
    if (typeof cmd.method !== 'string' || cmd.method.length < 1) return false
    if (cmd.params && !(cmd.params instanceof Array)) return false
    return true
  }

  // execute a command
  private async executeCommand(cmd: SMSICommand): Promise<any> {
    const service = this.services[cmd.service]
    if (!service) throw new Error(`Cannot invoke service ${cmd.service}: not found`)
    const method = service[cmd.method]
    if (!method) throw new Error(`Cannot invoke method ${cmd.method} on service ${cmd.service}: not found`)
    return await method.apply(null, cmd.params || [])
  }

}
