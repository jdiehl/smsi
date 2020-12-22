/// <reference types="node" />
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
export declare class SMSITransport extends EventEmitter {
    private socket;
    private handlers;
    private subscriptions;
    private requestRejections;
    constructor(socket: WebSocket);
    get connected(): boolean;
    sendExec(service: string, method: string, params: any[]): Promise<any[]>;
    sendSpec(service: string): Promise<any>;
    sendSubscribe(service: string, event: string, handler: Function): Promise<void>;
    sendUnsubscribe(service: string, event: string, handler?: Function): Promise<void>;
    sendResponse(id: string, response?: any): Promise<void>;
    sendEvent(service: string, event: string, params: any[]): Promise<void>;
    sendError(error: any, id?: string): Promise<void>;
    close(): Promise<void>;
    private send;
    private sendRequest;
    private onMessage;
    private validateMessage;
    private onClose;
}
