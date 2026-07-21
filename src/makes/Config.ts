import {PickProperties, PluginConfig} from "@wocker/core";
import {Service, ServiceProps} from "./Service";


export type ConfigProps = Omit<PickProperties<Config>, "services"> & {
    services?: ServiceProps[];
};

export class Config extends PluginConfig {
    public default?: string;
    public services: Service[];

    public constructor(data: ConfigProps) {
        super(data);

        const {
            default: defaultService,
            services = []
        } = data;

        this.default = defaultService;
        this.services = services.map((s) => {
            return new Service(s);
        });
    }

    public hasService(name: string): boolean {
        const service = this.services.find((service) => {
            return service.name === name;
        });

        return !!service;
    }

    public getService(name: string): Service {
        const service = this.services.find((service) => {
            return service.name === name;
        });

        if(!service) {
            throw new Error(`Browser "${name}" service not found`);
        }

        return service;
    }

    public hasDefaultService(): boolean {
        if(!this.default) {
            return false;
        }

        return this.hasService(this.default);
    }

    public getDefaultService(): Service {
        if(!this.default) {
            throw new Error("No services are installed by default");
        }

        return this.getService(this.default);
    }

    public getServiceOrDefault(name?: string): Service {
        if(!name) {
            return this.getDefaultService();
        }

        return this.getService(name);
    }

    public setService(service: Service): void {
        let exists = false;

        for(let i = 0; i < this.services.length; i++) {
            if(this.services[i].name === service.name) {
                exists = true;
                this.services[i] = service;
            }
        }

        if(!exists) {
            this.services.push(service);
        }

        if(!this.default) {
            this.default = service.name;
        }
    }

    public unsetService(name: string): void {
        this.services = this.services.filter((service) => {
            return service.name !== name;
        });

        if(this.default === name) {
            delete this.default;
        }
    }

    public toObject(): ConfigProps {
        return {
            default: this.default,
            services: this.services.length > 0 ? this.services.map((service) => {
                return service.toObject();
            }) : undefined
        };
    }
}
