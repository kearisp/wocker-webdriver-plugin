import {Service} from "../makes/Service";


export abstract class BrowserProvider {
    public constructor(
        protected readonly service: Service
    ) {}

    public abstract start(): Promise<void>;
    public abstract stop(): Promise<void>;
    public abstract remove(): Promise<void>;
    public abstract isRunning(): Promise<boolean>;
    public abstract getCdpUrl(): Promise<string>;
}
