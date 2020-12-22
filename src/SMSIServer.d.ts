/// <reference types="node" />
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { SMSIServerOptions } from './interfaces';
export declare class SMSIServer extends EventEmitter {
    private options;
    get address(): WebSocket.AddressInfo;
    server?: WebSocket.Server;
    private services;
    constructor(options?: SMSIServerOptions);
    expose(name: string, service: any): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    private onConnection;
    private serviceSpec;
    private serviceExec;
}
