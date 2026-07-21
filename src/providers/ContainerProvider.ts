import {DockerService} from "@wocker/core";
import {Service} from "../makes/Service";
import {BrowserProvider} from "../types/BrowserProvider";


export class ContainerProvider extends BrowserProvider {
    public constructor(
        service: Service,
        protected readonly dockerService: DockerService
    ) {
        super(service);
    }

    public async start(): Promise<void> {
        await this.dockerService.pullImage(this.service.image);

        let container = await this.dockerService.getContainer(this.service.containerName);

        if(!container) {
            console.info(`Starting ${this.service.name} service...`);

            container = await this.dockerService.createContainer({
                name: this.service.containerName,
                image: this.service.image,
                restart: "always",
                env: {
                    ...this.service.env,
                    ...this.service.port ? {
                        PORT: `${this.service.port}`
                    } : {}
                },
                networkMode: "host"
            });
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        if(!Running) {
            await container.start();
        }
    }

    public async stop(): Promise<void> {
        await this.dockerService.removeContainer(this.service.containerName);
    }

    public async remove(): Promise<void> {
        await this.dockerService.removeContainer(this.service.containerName);
    }

    public async isRunning(): Promise<boolean> {
        const container = await this.dockerService.getContainer(this.service.containerName);

        if(!container) {
            return false;
        }

        const {
            State: {
                Running
            }
        } = await container.inspect();

        return Running;
    }

    public async getCdpUrl(): Promise<string> {
        if(!await this.isRunning()) {
            throw new Error(`Service "${this.service.name}" is not started. Run "ws browser:start" first.`);
        }

        return `http://localhost:${this.service.port || 3000}`;
    }
}
