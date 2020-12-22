/// <reference types="node" />
import { EventEmitter } from 'events';
export declare class SMSIClient extends EventEmitter {
    private url;
    private transport?;
    constructor(url: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    exec(service: string, method: string, params?: any[]): Promise<any>;
    subscribe(service: string, event: string, handler: Function): Promise<void>;
    unsubscribe(service: string, event: string, handler: Function): Promise<void>;
    makeProxy<T = any>(service: string): Promise<T>;
    private onClose;
}
