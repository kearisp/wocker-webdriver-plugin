import {BrowserProvider} from "../types/BrowserProvider";


export class UrlProvider extends BrowserProvider {
    public async start(): Promise<void> {
        throw new Error(`Service "${this.service.name}" uses the url provider, there's nothing for wocker to start`);
    }

    public async stop(): Promise<void> {
        throw new Error(`Service "${this.service.name}" uses the url provider, there's nothing for wocker to stop`);
    }

    public async remove(): Promise<void> {}

    public async isRunning(): Promise<boolean> {
        return true;
    }

    public async getCdpUrl(): Promise<string> {
        if(!this.service.url) {
            throw new Error(`Service "${this.service.name}" has no url configured`);
        }

        return this.service.url;
    }
}
