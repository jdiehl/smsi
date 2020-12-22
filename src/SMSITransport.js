"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSITransport = void 0;
const events_1 = require("events");
const uuid = require("uuid");
class SMSITransport extends events_1.EventEmitter {
    constructor(socket) {
        super();
        this.socket = socket;
        this.handlers = {};
        this.subscriptions = {};
        this.requestRejections = [];
        this.socket.on('error', err => this.emit('error', err));
        this.socket.on('open', () => this.emit('open'));
        this.socket.on('close', () => this.onClose());
        this.socket.on('message', message => this.onMessage(message));
    }
    get connected() {
        return this.socket.readyState === 1;
    }
    async sendExec(service, method, params) {
        const type = 'exec';
        return this.sendRequest({ type, service, method, params });
    }
    async sendSpec(service) {
        const type = 'spec';
        return this.sendRequest({ type, service });
    }
    async sendSubscribe(service, event, handler) {
        this.subscriptions[service] = this.subscriptions[service] || {};
        this.subscriptions[service][event] = this.subscriptions[service][event] || [];
        this.subscriptions[service][event].push(handler);
        const type = 'subscribe';
        await this.sendRequest({ type, service, event });
    }
    async sendUnsubscribe(service, event, handler) {
        if (!this.subscriptions[service])
            return;
        if (!this.subscriptions[service][event])
            return;
        if (handler) {
            this.subscriptions[service][event] = this.subscriptions[service][event].filter(fn => fn === handler);
        }
        else {
            delete this.subscriptions[service][event];
        }
        const type = 'unsubscribe';
        await this.sendRequest({ type, service, event });
    }
    sendResponse(id, response) {
        const type = 'response';
        return this.send({ id, type, response });
    }
    sendEvent(service, event, params) {
        const type = 'event';
        return this.send({ type, service, event, params });
    }
    // send error
    sendError(error, id) {
        if (!error || typeof error.toString !== 'function')
            error = 'Unknown error';
        if (error.message)
            error = error.message;
        error = error.toString();
        const type = 'error';
        return this.send({ id, type, error });
    }
    async close() {
        await new Promise(resolve => {
            this.socket.on('close', () => resolve());
            this.socket.close();
        });
    }
    // private methods
    // send a message
    send(data) {
        if (!this.connected)
            return Promise.reject('Not connected');
        const message = JSON.stringify(data);
        return new Promise((resolve, reject) => {
            this.socket.send(message, err => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
    // send a request
    async sendRequest(data) {
        const id = uuid.v4();
        data.id = id;
        await this.send(data);
        return new Promise((resolve, reject) => {
            this.requestRejections.push(reject);
            this.handlers[id] = (err, response) => {
                const i = this.requestRejections.indexOf(reject);
                this.requestRejections.splice(i, 1);
                err ? reject(err) : resolve(response);
                delete this.handlers[id];
            };
        });
    }
    onMessage(data) {
        let message;
        // parse message
        try {
            message = JSON.parse(data.toString());
        }
        catch (err) {
            this.sendError(`Invalid message: parse error`);
            return;
        }
        // validate message
        const error = this.validateMessage(message);
        if (error) {
            this.sendError(`Invalid message: ${error}`);
            return;
        }
        switch (message.type) {
            case 'response': {
                const handler = this.handlers[message.id];
                if (!handler) {
                    this.sendError(`unknown id ${message.id}`);
                    return;
                }
                handler(null, message.response);
                return;
            }
            case 'event': {
                const { service, event } = message;
                if (!this.subscriptions[service])
                    return;
                if (!this.subscriptions[service][event])
                    return;
                for (const handler of this.subscriptions[service][event]) {
                    handler(...(message.params || []));
                }
                return;
            }
            case 'error': {
                if (message.id) {
                    this.handlers[message.id](message.error);
                }
                else {
                    this.emit('error', message.error);
                }
                return;
            }
            default:
                this.emit(message.type, message);
        }
    }
    validateMessage(message) {
        if (typeof message !== 'object')
            return 'not an object';
        if (typeof message.type !== 'string')
            return 'type not a string';
        switch (message.type) {
            case 'spec':
                if (message.id === undefined)
                    return 'id missing';
                if (typeof message.service !== 'string' || message.service.length < 1)
                    return 'service not a string';
                break;
            case 'error':
                if (typeof message.error !== 'string')
                    return 'error not a string';
                break;
            case 'response':
                if (message.id === undefined)
                    return 'id missing';
                break;
            case 'event':
                if (typeof message.service !== 'string' || message.service.length < 1)
                    return 'service not a string';
                if (typeof message.event !== 'string' || message.event.length < 1)
                    return 'event not a string';
                if (message.params && !(message.params instanceof Array))
                    return 'params not an array';
                break;
            case 'exec':
                if (message.id === undefined)
                    return 'id missing';
                if (typeof message.service !== 'string' || message.service.length < 1)
                    return 'service not a string';
                if (typeof message.method !== 'string' || message.method.length < 1)
                    return 'method not a string';
                if (message.params && !(message.params instanceof Array))
                    return 'params not an array';
                break;
            case 'subscribe':
            case 'unsubscribe':
                if (message.id === undefined)
                    return 'id missing';
                if (typeof message.service !== 'string' || message.service.length < 1)
                    return 'service not a string';
                if (typeof message.event !== 'string' || message.event.length < 1)
                    return 'event not a string';
                break;
            default:
                return 'unknown type';
        }
    }
    // reject all outstanding requests
    onClose() {
        this.emit('close');
        for (const reject of this.requestRejections) {
            reject('Connection closed');
        }
        this.requestRejections = [];
    }
}
exports.SMSITransport = SMSITransport;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU01TSVRyYW5zcG9ydC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlNNU0lUcmFuc3BvcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXFDO0FBQ3JDLDZCQUE0QjtBQUc1QixNQUFhLGFBQWMsU0FBUSxxQkFBWTtJQUs3QyxZQUFvQixNQUFpQjtRQUNuQyxLQUFLLEVBQUUsQ0FBQTtRQURXLFdBQU0sR0FBTixNQUFNLENBQVc7UUFKN0IsYUFBUSxHQUE2QixFQUFFLENBQUE7UUFDdkMsa0JBQWEsR0FBK0MsRUFBRSxDQUFBO1FBQzlELHNCQUFpQixHQUFlLEVBQUUsQ0FBQTtRQUl4QyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBQ3ZELElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFDL0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFBO1FBQzdDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQTtJQUMvRCxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1gsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUE7SUFDckMsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBZSxFQUFFLE1BQWMsRUFBRSxNQUFhO1FBQzNELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQTtRQUNuQixP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