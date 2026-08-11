import {EnvConfig} from "@wocker/core";
import {Image} from "@wocker/utils";
import {ProviderType} from "../types/ProviderType";
import {BrowserType} from "../types/BrowserType";


export type ServiceProps = {
    name: string;
    browser?: BrowserType;
    provider?: ProviderType;
    image?: string;
    env?: EnvConfig;
    port?: number;
    path?: string;
    url?: string;
    headless?: boolean;
};

export class Service {
    public name: string;
    public browser: BrowserType;
    public provider: ProviderType;
    protected _image?: string;
    public env?: EnvConfig;
    public port?: number;
    public path?: string;
    public url?: string;
    public headless: boolean;

    public constructor(data: ServiceProps) {
        const {
            name,
            browser = BrowserType.CHROMIUM,
            provider = ProviderType.CONTAINER,
            image,
            env,
            port,
            path,
            url,
            headless = true
        } = data;

        this.name = name;
        this.browser = browser;
        this.provider = provider;
        this._image = image;
        this.env = env;
        this.port = port;
        this.path = path;
        this.url = url;
        this.headless = headless;
    }

    public get containerName(): string {
        return `browser-${this.name}.ws`;
    }

    public get image(): string {
        if(!this._image) {
            return "browserless/chrome:latest";
        }

        return this._image;
    }

    public set image(image: string | undefined) {
        if(!image) {
            delete this._image;
            return;
        }

        if(!Image.isValid(image)) {
            throw new Error(`Invalid image ${image}`);
        }

        this._image = image;
    }

    public get location(): string {
        switch(this.provider) {
            case ProviderType.HOST:
                return this.path || "";

            case ProviderType.URL:
                return this.url || "";

            case ProviderType.CONTAINER:
            default:
                return this.containerName;
        }
    }

    public toObject(): ServiceProps {
        return {
            name: this.name,
            browser: this.browser,
            provider: this.provider,
            image: this._image,
            env: this.env,
            port: this.port,
            path: this.path,
            url: this.url,
            headless: this.headless
        };
    }
}
