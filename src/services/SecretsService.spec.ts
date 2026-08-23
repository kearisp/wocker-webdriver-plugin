import {describe, it, expect, beforeEach} from "@jest/globals";
import {ApplicationContext, ProjectService} from "@wocker/core";
import {Test} from "@wocker/testing";
import {SecretsService} from "./SecretsService";


class FakeProject {
    public store = new Map<string, string>();

    public async getSecret(key: string, byDefault?: string): Promise<string | undefined> {
        return this.store.has(key) ? this.store.get(key) : byDefault;
    }

    public async setSecret(key: string, value: string): Promise<void> {
        this.store.set(key, value);
    }
}

class FakeProjectService extends ProjectService {
    public project = new FakeProject();

    public get(): any {
        return this.project;
    }

    public save(): void {}

    public async start(): Promise<void> {}

    public async stop(): Promise<void> {}

    public search(): any[] {
        return [];
    }
}


describe("SecretsService", (): void => {
    let context: ApplicationContext;
    let secretsService: SecretsService;
    let fakeProjectService: FakeProjectService;

    beforeEach(async (): Promise<void> => {
        fakeProjectService = new FakeProjectService();

        context = await Test
            .createTestingModule({
                providers: [
                    SecretsService,
                    {
                        // ProjectService is @Injectable("PROJECT_SERVICE") — the DI
                        // container resolves constructor-param injection by that string
                        // token, and only replaces an already-registered provider, so it
                        // must be supplied directly here rather than via overrideProvider.
                        provide: "PROJECT_SERVICE",
                        useValue: fakeProjectService
                    }
                ]
            })
            .build();

        secretsService = context.get(SecretsService);
    });

    it("generatePassword() creates and stores a secret without returning its value", async (): Promise<void> => {
        const result = await secretsService.generatePassword("demo_pw");

        expect(result).toBeUndefined();
        expect(await secretsService.hasSecret("demo_pw")).toBe(true);

        const value = await secretsService.resolveSecret("demo_pw");

        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
    });

    it("setSecret()/resolveSecret() roundtrip", async (): Promise<void> => {
        await secretsService.setSecret("token", "s3cr3t");

        expect(await secretsService.resolveSecret("token")).toBe("s3cr3t");

        await secretsService.setSecret("token", "n3w-s3cr3t");

        expect(await secretsService.resolveSecret("token")).toBe("n3w-s3cr3t");
    });

    it("hasSecret() reflects presence in the project's secret store", async (): Promise<void> => {
        expect(await secretsService.hasSecret("missing")).toBe(false);

        await secretsService.generatePassword("present");

        expect(await secretsService.hasSecret("present")).toBe(true);
    });

    it("setSecret() writes straight to the project's own secret store", async (): Promise<void> => {
        await secretsService.setSecret("shared", "value");

        expect(await fakeProjectService.project.getSecret("shared")).toBe("value");
    });

    it("resolveSecret() throws for an unknown name", async (): Promise<void> => {
        await expect(secretsService.resolveSecret("nope")).rejects.toThrow("not found");
        await expect(secretsService.resolveSecret("nope")).rejects.toThrow("ws secret:create nope");
    });
});
