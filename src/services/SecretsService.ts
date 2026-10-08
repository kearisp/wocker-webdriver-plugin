import {Injectable, ProjectService} from "@wocker/core";
import {generatePassword as randomPassword} from "../utils/generatePassword";


@Injectable()
export class SecretsService {
    public constructor(
        protected readonly projectService: ProjectService
    ) {}

    public async generatePassword(name: string, length = 24): Promise<void> {
        await this.setSecret(name, randomPassword(length));
    }

    public async setSecret(name: string, value: string): Promise<void> {
        await this.projectService.get().setSecret(name, value);
    }

    public async hasSecret(name: string): Promise<boolean> {
        return (await this.projectService.get().getSecret(name)) !== undefined;
    }

    // INTERNAL — not part of ProjectHelper. Only BrowserService's fillWithSecret
    // implementation may call this; scripts must never receive the resolved value.
    public async resolveSecret(name: string): Promise<string> {
        const value = await this.projectService.get().getSecret(name);

        if(!value) {
            throw new Error(`Secret "${name}" not found. Use helper.generatePassword()/helper.setSecret(), or "ws secret:create ${name}", first.`);
        }

        return value;
    }
}
