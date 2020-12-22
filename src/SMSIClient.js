"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSIClient = void 0;
const events_1 = require("events");
const WebSocket = require("ws");
const SMSITransport_1 = require("./SMSITransport");
class SMSIClient extends events_1.EventEmitter {
    constructor(url) {
        super();
        this.url = url;
    }
    async start() {
        if (this.transport)
            return;
        await new Promise(resolve => {
            const ws = new WebSocket(this.url);
            this.transport = new SMSITransport_1.SMSITransport(ws);
            this.transport.on('error', err => this.emit('error', err));
            this.transport.on('close', () => this.onClose());
            this.transport.on('open', () => resolve());
        });
    }
    async stop() {
        if (!this.transport)
            return;
        await this.transport.close();
        this.transport = undefined;
    }
    async exec(service, method, params = []) {
        if (!this.transport)
            await this.start();
        return this.transport.sendExec(service, method, params);
    }
    async subscribe(service, event, handler) {
        if (!this.transport)
            await this.start();
        await this.transport.sendSubscribe(service, event, handler);
    }
    async unsubscribe(service, event, handler) {
        if (!this.transport)
            await this.start();
        await this.transport.sendUnsubscribe(service, event, handler);
    }
    async makeProxy(service) {
        if (!this.transport)
            await this.start();
        // query the spec
        const spec = await this.transport.sendSpec(service);
        // construct the proxy object
        const proxy = {};
        // methods
        for (const method of spec.methods) {
            proxy[method] = async (...params) => this.exec(service, method, params);
        }
        // events
        if (spec.events) {
            proxy.on = async (event, handler) => this.subscribe(service, event, handler);
            proxy.off = async (event, handler) => this.unsubscribe(service, event, handler);
        }
        return proxy;
    }
    // private methods
    onClose() {
        this.transport = undefined;
    }
}
exports.SMSIClient = SMSIClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU01TSUNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlNNU0lDbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXFDO0FBQ3JDLGdDQUErQjtBQUMvQixtREFBK0M7QUFFL0MsTUFBYSxVQUFXLFNBQVEscUJBQVk7SUFHMUMsWUFBb0IsR0FBVztRQUM3QixLQUFLLEVBQUUsQ0FBQTtRQURXLFFBQUcsR0FBSCxHQUFHLENBQVE7SUFFL0IsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1QsSUFBSSxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU07UUFFMUIsTUFBTSxJQUFJLE9BQU8sQ0FBTyxPQUFPLENBQUMsRUFBRTtZQUNoQyxNQUFNLEVBQUUsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7WUFDbEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLDZCQUFhLENBQUMsRUFBRSxDQUFDLENBQUE7WUFDdEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtZQUMxRCxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7WUFDaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7UUFDNUMsQ0FBQyxDQUFDLENBQUE7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVM7WUFBRSxPQUFNO1FBRTNCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQTtRQUM1QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQTtJQUM1QixDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFlLEVBQUUsTUFBYyxFQUFFLFNBQWdCLEVBQUU7UUFDNUQsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUE7UUFDdkMsT0FBTyxJQUFJLENBQUMsU0FBVSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFBO0lBQzFELENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQWUsRUFBRSxLQUFhLEVBQUUsT0FBaUI7UUFDL0QsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUE7UUFDdkMsTUFBTSxJQUFJLENBQUMsU0FBVSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQzlELENBQUM7SUFFRCxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQWUsRUFBRSxLQUFhLEVBQUUsT0FBaUI7UUFDakUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUE7UUFDdkMsTUFBTSxJQUFJLENBQUMsU0FBVSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQ2hFLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFVLE9BQWU7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUE7UUFFdkMsaUJBQWlCO1FBQ2pCLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUE7UUFFcEQsNkJBQTZCO1FBQzdCLE1BQU0sS0FBSyxHQUFRLEVBQUUsQ0FBQTtRQUVyQixVQUFVO1FBQ1YsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2pDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLEVBQUUsR0FBRyxNQUFhLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQTtTQUMvRTtRQUVELFNBQVM7UUFDVCxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDZixLQUFLLENBQUMsRUFBRSxHQUFHLEtBQUssRUFBRSxLQUFhLEVBQUUsT0FBaUIsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFBO1lBQzlGLEtBQUssQ0FBQyxHQUFHLEdBQUcsS0FBSyxFQUFFLEtBQWEsRUFBRSxPQUFpQixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUE7U0FDbEc7UUFFRCxPQUFPLEtBQUssQ0FBQTtJQUNkLENBQUM7SUFFRCxrQkFBa0I7SUFFVixPQUFPO1FBQ2IsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUE7SUFDNUIsQ0FBQztDQUNGO0FBckVELGdDQXFFQyJ9