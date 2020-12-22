"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSIServer = void 0;
const events_1 = require("events");
const WebSocket = require("ws");
const SMSITransport_1 = require("./SMSITransport");
const util_1 = require("./util");
class SMSIServer extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.services = {};
    }
    get address() {
        if (!this.server)
            throw new Error(`Cannot get address: server not running`);
        return this.server.address();
    }
    // expose a microservice
    expose(name, service) {
        if (this.services[name])
            throw new Error(`Cannot expose service: service with name ${name} exists already`);
        this.services[name] = service;
    }
    // start the server and listen on the given port
    async start() {
        if (this.server)
            return;
        // start server
        await new Promise(resolve => {
            this.server = new WebSocket.Server(this.options);
            this.server.on('connection', connection => this.onConnection(connection));
            this.server.on('error', err => this.emit('error', err));
            this.server.on('listening', () => resolve());
        });
    }
    async stop() {
        if (!this.server)
            return;
        // stop server
        await new Promise((resolve, reject) => this.server.close((err) => err ? reject(err) : resolve()));
        this.server = undefined;
    }
    // private methods
    async onConnection(connection) {
        const transport = new SMSITransport_1.SMSITransport(connection);
        let handlers = {};
        // error handling
        transport.on('error', err => this.emit('error', err));
        // remove all event handlers
        transport.on('close', () => {
            for (const service of Object.keys(handlers)) {
                for (const event of Object.keys(handlers[service])) {
                    this.services[service].off(event, handlers[service][event]);
                }
            }
            handlers = {};
        });
        // send the spec
        transport.on('spec', async ({ id, service }) => {
            try {
                const spec = this.serviceSpec(service);
                transport.sendResponse(id, spec);
            }
            catch (err) {
                transport.sendError(err, id);
            }
        });
        // execute a method
        transport.on('exec', async ({ id, service, method, params }) => {
            try {
                const res = await this.serviceExec(service, method, params);
                transport.sendResponse(id, res);
            }
            catch (err) {
                transport.sendError(err, id);
            }
        });
        // subscribe to events
        transport.on('subscribe', async ({ id, service, event }) => {
            const s = this.services[service];
            if (!util_1.isEventEmitter(s))
                return transport.sendError(`Invalid service or service does not support events: ${service}`, id);
            if (!handlers[service])
                handlers[service] = {};
            if (handlers[service][event])
                return transport.sendError(`Already subscribed to event: ${service}#${event}`, id);
            handlers[service][event] = (...params) => {
                if (transport.connected)
                    transport.sendEvent(service, event, params);
            };
            s.on(event, handlers[service][event]);
            transport.sendResponse(id);
        });
        // unsubscribe from events
        transport.on('unsubscribe', async ({ id, service, event }) => {
            const s = this.services[service];
            if (!util_1.isEventEmitter(s))
                return transport.sendError(`Invalid service or service does not support events: ${service}`, id);
            if (!handlers[service] || !handlers[service][event])
                return transport.sendError(`Not subscribed to event: ${service}#${event}`, id);
            s.off(event, handlers[service][event]);
            delete handlers[service][event];
            transport.sendResponse(id);
        });
    }
    serviceSpec(name) {
        const service = this.services[name];
        if (!service)
            throw new Error(`Invalid service: ${name}`);
        const methods = Object.keys(service).filter(key => typeof service[key] === 'function');
        const events = util_1.isEventEmitter(service);
        return { methods, events };
    }
    async serviceExec(name, method, params) {
        const service = this.services[name];
        if (!service)
            throw new Error(`Invalid service: ${name}`);
        if (typeof service[method] !== 'function')
            throw new Error(`Invalid method: ${name}.${method}`);
        return await service[method](...params);
    }
}
exports.SMSIServer = SMSIServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU01TSVNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlNNU0lTZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXFDO0FBQ3JDLGdDQUErQjtBQUUvQixtREFBK0M7QUFDL0MsaUNBQXVDO0FBRXZDLE1BQWEsVUFBVyxTQUFRLHFCQUFZO0lBVTFDLFlBQW9CLFVBQTZCLEVBQUU7UUFDakQsS0FBSyxFQUFFLENBQUE7UUFEVyxZQUFPLEdBQVAsT0FBTyxDQUF3QjtRQUYzQyxhQUFRLEdBQXdCLEVBQUUsQ0FBQTtJQUkxQyxDQUFDO0lBVkQsSUFBSSxPQUFPO1FBQ1QsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFBO1FBQzNFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQTJCLENBQUE7SUFDdkQsQ0FBQztJQVNELHdCQUF3QjtJQUN4QixNQUFNLENBQUMsSUFBWSxFQUFFLE9BQVk7UUFDL0IsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLElBQUksaUJBQWlCLENBQUMsQ0FBQTtRQUMzRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQTtJQUMvQixDQUFDO0lBRUQsZ0RBQWdEO0lBQ2hELEtBQUssQ0FBQyxLQUFLO1FBQ1QsSUFBSSxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU07UUFFdkIsZUFBZTtRQUNmLE1BQU0sSUFBSSxPQUFPLENBQU8sT0FBTyxDQUFDLEVBQUU7WUFDaEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLElB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