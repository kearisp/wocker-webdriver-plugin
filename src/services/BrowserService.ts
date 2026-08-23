import {DockerService, Injectable, PluginConfigService, ProjectService} from "@wocker/core";
import {promptConfirm, promptInput, promptSelect} from "@wocker/prompts";
import CliTable from "cli-table3";
import * as Path from "path";
import puppeteer, {Browser, Page, Viewport} from "puppeteer-core";
import {Config} from "../makes/Config";
import {Service, ServiceProps} from "../makes/Service";
import {ProviderType} from "../types/ProviderType";
import {BrowserProvider} from "../types/BrowserProvider";
import {ProjectHelper} from "../types/ProjectHelper";
import {ContainerProvider} from "../providers/ContainerProvider";
import {HostProvider} from "../providers/HostProvider";
import {UrlProvider} from "../providers/UrlProvider";
import {detectBrowsers} from "../utils/detectBrowsers";
import {hideWindowByPid, showWindowByPid} from "../utils/x11";
import {redactDeep} from "../utils/redact";
import {BrowserTypeEnum} from "../types/BrowserType";
import {SecretsService} from "./SecretsService";


export type EvalHandler = (page: Page, helper: ProjectHelper) => unknown;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => EvalHandler;


@Injectable()
export class BrowserService {
    protected _config?: Config;

    public constructor(
        protected readonly pluginConfigService: PluginConfigService,
        protected readonly dockerService: DockerService,
        protected readonly projectService: ProjectService,
        protected readonly secretsService: SecretsService
    ) {}

    public get config(): Config {
        if(!this._config) {
            this._config = this.pluginConfigService.getConfig(Config);
        }

        return this._config;
    }

    protected getProvider(service: Service): BrowserProvider {
        switch(service.provider) {
            case ProviderType.CONTAINER:
                return new ContainerProvider(service, this.dockerService);

            case ProviderType.HOST: {
                this.pluginConfigService.fs.mkdir("pids", {
                    recursive: true
                });
                this.pluginConfigService.fs.mkdir("logs", {
                    recursive: true
                });

                return new HostProvider(
                    service,
                    this.pluginConfigService.fs.path(`pids/${service.name}.pid`),
                    this.pluginConfigService.fs.path(`profiles/${service.name}`),
                    this.pluginConfigService.fs.path(`logs/${service.name}.log`)
                );
            }

            case ProviderType.URL:
                return new UrlProvider(service);

            default:
                throw new Error(`Unsupported provider "${service.provider}"`);
        }
    }

    public async list(): Promise<string> {
        const config = this.config;

        const table = new CliTable({
            head: ["Name", "Provider", "Location", "Running"]
        });

        for(const service of config.services) {
            const running = await this.getProvider(service).isRunning();

            table.push([
                service.name + (config.default === service.name ? " (default)" : ""),
                ProviderType.label(service.provider),
                service.location,
                running
            ]);
        }

        return table.toString();
    }

    public getServices(): string[] {
        return (this.config.services || []).map((service) => {
            return service.name;
        });
    }

    public async create(serviceProps: Partial<ServiceProps> = {}): Promise<void> {
        if(serviceProps.name && this.config.hasService(serviceProps.name)) {
            console.info(`Service "${serviceProps.name}" is already exists`);
            delete serviceProps.name;
        }

        if(!serviceProps.name) {
            serviceProps.name = await promptInput({
                message: "Service name",
                required: "Service name is required",
                validate: (value?: string) => {
                    if(value && this.config.hasService(value)) {
                        return `Service "${value}" is already exists`;
                    }

                    return true;
                }
            });
        }

        if(!serviceProps.provider) {
            serviceProps.provider = await promptSelect<ProviderType>({
                message: "Provider:",
                options: ProviderType.options(),
                default: ProviderType.CONTAINER
            });
        }

        if(serviceProps.provider === ProviderType.URL && !serviceProps.url) {
            serviceProps.url = await promptInput({
                message: "Browser URL (CDP address of the already-running browser)",
                required: true
            });
        }

        if(serviceProps.provider === ProviderType.HOST && !serviceProps.path) {
            serviceProps.path = await this.promptForPath();
        }

        if(serviceProps.provider === ProviderType.HOST && typeof serviceProps.headless === "undefined") {
            serviceProps.headless = await promptConfirm({
                message: "Run headless?",
                default: true
            });
        }

        this.config.setService(new Service(serviceProps as ServiceProps));
        this.config.save();
    }

    protected async promptForPath(): Promise<string> {
        const browsers = detectBrowsers();

        const MANUAL_PATH = "__manual__";

        let path: string = MANUAL_PATH;

        if(browsers.length > 0) {
            path = await promptSelect<string>({
                message: "Browser:",
                options: [
                    ...browsers.map((browser) => {
                        return {
                            label: `${browser.name} (${browser.path})`,
                            value: browser.path
                        };
                    }),
                    {
                        label: "Enter path manually...",
                        value: MANUAL_PATH
                    }
                ]
            });
        }

        if(path === MANUAL_PATH) {
            path = await promptInput({
                message: "Path to the browser executable",
                required: true
            });
        }

        return path;
    }

    public async upgrade(serviceProps: Partial<ServiceProps> = {}): Promise<void> {
        const service = this.config.getServiceOrDefault(serviceProps.name);

        if(serviceProps.provider) {
            if(!ProviderType.values().includes(serviceProps.provider)) {
                throw new Error("Invalid provider");
            }

            service.provider = serviceProps.provider;
        }

        if(serviceProps.url) {
            service.url = serviceProps.url;
        }

        if(serviceProps.path) {
            service.path = serviceProps.path;
        }

        if(serviceProps.image) {
            service.image = serviceProps.image;
        }

        if(serviceProps.port) {
            service.port = serviceProps.port;
        }

        if(typeof serviceProps.headless !== "undefined") {
            service.headless = serviceProps.headless;
        }

        this.config.setService(service);
        this.config.save();
    }

    public async start(name?: string, restart?: boolean): Promise<void> {
        if(!name && !this.config.hasDefaultService()) {
            await this.create();
        }

        const service = this.config.getServiceOrDefault(name);
        const provider = this.getProvider(service);

        if(restart) {
            await provider.stop();
        }

        await provider.start();
    }

    public async stop(name?: string): Promise<void> {
        const service = this.config.getServiceOrDefault(name);

        console.info("Browser stopping...");

        await this.getProvider(service).stop();
    }

    public async destroy(name?: string, yes?: boolean, force?: boolean): Promise<void> {
        if(!name) {
            throw new Error("Service name required");
        }

        const service = this.config.getService(name);

        if(this.config.default === service.name && !force) {
            throw new Error("Can't destroy default service");
        }

        if(!yes) {
            const confirm = await promptConfirm({
                message: `Are you sure you want to delete the "${name}" service?`,
                default: false
            });

            if(!confirm) {
                throw new Error("Aborted");
            }
        }

        await this.getProvider(service).remove();

        this.config.unsetService(name);
        this.config.save();
    }

    public async hideWindow(name?: string): Promise<void> {
        hideWindowByPid(this.getPid(name));
    }

    public async showWindow(name?: string): Promise<void> {
        showWindowByPid(this.getPid(name));
    }

    protected getPid(name?: string): number {
        const service = this.config.getServiceOrDefault(name);
        const pid = this.getProvider(service).getPid();

        if(!pid) {
            throw new Error(`Service "${service.name}" has no process to find a window for (only host-provider services running have one).`);
        }

        return pid;
    }

    public async cdp(name?: string): Promise<string> {
        if(!name && !this.config.hasDefaultService()) {
            throw new Error("No browser service configured. Run \"ws browser:create\" and \"ws browser:start\" first.");
        }

        const service = this.config.getServiceOrDefault(name);

        return this.getProvider(service).getCdpUrl();
    }

    public async exec(scriptPath: string, name?: string, tab?: string, viewport?: string, isNew?: boolean): Promise<unknown> {
        const fullPath = Path.resolve(process.cwd(), scriptPath);
        const exported = require(fullPath);
        const handler: EvalHandler = typeof exported === "function" ? exported : exported.default;

        if(typeof handler !== "function") {
            throw new Error(`"${scriptPath}" must export a function: (page, helper) => { ... }`);
        }

        return this.run(handler, name, tab, viewport, isNew);
    }

    public async eval(code: string, name?: string, tab?: string, viewport?: string, isNew?: boolean): Promise<unknown> {
        const handler = new AsyncFunction("page", "helper", code) as EvalHandler;

        return this.run(handler, name, tab, viewport, isNew);
    }

    public async pages(name?: string): Promise<string> {
        const service = this.config.getServiceOrDefault(name);
        const cdpUrl = await this.cdp(name);

        const browser = await puppeteer.connect({
            ...this.endpointOptions(cdpUrl),
            protocol: service.browser === BrowserTypeEnum.CHROMIUM ? "cdp" : "webDriverBiDi",
            defaultViewport: null
        });

        try {
            const pages = await browser.pages();

            const table = new CliTable({
                head: ["#", "Active", "Title", "URL"]
            });

            for(let i = 0; i < pages.length; i++) {
                const active = await this.isVisible(pages[i]);

                table.push([i, active ? "*" : "", await pages[i].title().catch(() => ""), pages[i].url()]);
            }

            return table.toString();
        }
        finally {
            await browser.disconnect().catch(() => {});
        }
    }

    protected async run(handler: EvalHandler, name?: string, tab?: string, viewport?: string, isNew?: boolean): Promise<unknown> {
        if(tab && isNew) {
            throw new Error("--tab and --new can't be used together");
        }

        const service = this.config.getServiceOrDefault(name);

        const cdpUrl = await this.cdp(name);

        const browser = await puppeteer.connect({
            ...this.endpointOptions(cdpUrl),
            protocol: service.browser === BrowserTypeEnum.CHROMIUM ? "cdp" : "webDriverBiDi",
            defaultViewport: this.parseViewport(viewport)
        });

        let page: Page;

        if(isNew) {
            page = await browser.newPage();
        }
        else if(tab) {
            const pages = await browser.pages();
            const found = this.findTab(pages, tab);

            if(!found) {
                await browser.disconnect().catch(() => {});

                throw new Error(`No open tab matching "${tab}". Run "ws browser:pages" to see what's open.`);
            }

            page = found;
        }
        else {
            page = await this.findActiveTab(browser);
        }

        const strayRejections: unknown[] = [];

        const onUnhandledRejection = (reason: unknown) => {
            strayRejections.push(reason);
        };

        process.on("unhandledRejection", onUnhandledRejection);

        // Every plaintext value fillWithSecret() ever resolves during this run gets
        // recorded here (host-side only — the script never sees this set), so it can
        // be scrubbed from anything that's about to be printed, even if it leaked in
        // through a side channel (e.g. a script logging a page's own confirmation text
        // that happens to echo the value back) rather than the script's own doing.
        const touchedSecrets = new Set<string>();

        const project = this.projectService.get();

        const helper: ProjectHelper = {
            getEnv: (key: string, byDefault?: string) => project.getEnv(key, byDefault as string),
            hasEnv: (key) => project.hasEnv(key),
            getMeta: (key: string, byDefault?: string) => project.getMeta(key, byDefault as string),
            hasMeta: (key) => project.hasMeta(key),
            generatePassword: (secretName, length) => this.secretsService.generatePassword(secretName, length),
            setSecret: (secretName, value) => this.secretsService.setSecret(secretName, value),
            hasSecret: (secretName) => this.secretsService.hasSecret(secretName),
            fillWithSecret: async (selector, secretName) => {
                const value = await this.secretsService.resolveSecret(secretName);

                touchedSecrets.add(value);

                await page.locator(selector).fill(value);
            }
        };

        const restoreOutput = this.patchOutputForRedaction(touchedSecrets);

        try {
            const result = await handler(page, helper);

            return redactDeep(result, touchedSecrets);
        }
        finally {
            restoreOutput();

            await browser.disconnect().catch(() => {});

            await new Promise((resolve) => setImmediate(resolve));

            process.off("unhandledRejection", onUnhandledRejection);

            if(strayRejections.length > 0) {
                console.error("Warning: the script didn't await one or more promises (e.g. \"page.goto(...)\" without \"await\") — they were aborted when the connection to the browser closed.");
            }
        }
    }

    // Scrubs any secret value a script might print (console.log, a thrown error's
    // message, etc.) before it actually reaches stdout/stderr. This runs regardless
    // of what the script does — it doesn't rely on the script cooperating — but it's
    // still only an exact-substring match, so a re-encoded copy of a value slips
    // through; see README's "Secrets" section for the documented limitation.
    protected patchOutputForRedaction(touchedSecrets: ReadonlySet<string>): () => void {
        const originalStdoutWrite = process.stdout.write.bind(process.stdout);
        const originalStderrWrite = process.stderr.write.bind(process.stderr);

        const wrap = (original: typeof process.stdout.write): typeof process.stdout.write => {
            return ((chunk: unknown, ...args: unknown[]) => {
                const text = typeof chunk === "string" ? chunk : chunk instanceof Buffer ? chunk.toString() : chunk;

                const redacted = typeof text === "string" ? redactDeep(text, touchedSecrets) : text;

                return (original as (...a: unknown[]) => boolean)(redacted, ...args);
            }) as typeof process.stdout.write;
        };

        process.stdout.write = wrap(originalStdoutWrite);
        process.stderr.write = wrap(originalStderrWrite);

        return () => {
            process.stdout.write = originalStdoutWrite;
            process.stderr.write = originalStderrWrite;
        };
    }

    // The CDP tree has no "active tab" flag — visibilityState is the only
    // signal a page exposes for whether it's the one currently in the
    // foreground, so we probe each open page for it.
    protected async findActiveTab(browser: Browser): Promise<Page> {
        const pages = await browser.pages();

        for(const page of pages) {
            if(await this.isVisible(page)) {
                return page;
            }
        }

        return pages[0] || await browser.newPage();
    }

    protected isVisible(page: Page): Promise<boolean> {
        return page.evaluate(() => document.visibilityState === "visible").catch(() => false);
    }

    protected endpointOptions(endpoint: string): {browserURL: string} | {browserWSEndpoint: string} {
        if(endpoint.startsWith("ws://") || endpoint.startsWith("wss://")) {
            return {
                browserWSEndpoint: endpoint
            };
        }

        return {
            browserURL: endpoint
        };
    }

    public async screenshot(name?: string, tab?: string, selector?: string, out?: string, fullPage?: boolean, viewport?: string, isNew?: boolean): Promise<string> {
        const outPath = out
            ? Path.resolve(process.cwd(), out)
            : Path.join("/tmp", `screenshot-${Date.now()}.png`);

        await this.run(async (page) => {
            if(selector) {
                const element = await page.$(selector);

                if(!element) {
                    throw new Error(`No element matching selector "${selector}"`);
                }

                await element.screenshot({
                    path: outPath
                });

                return;
            }

            await page.screenshot({
                path: outPath,
                fullPage
            });
        }, name, tab, viewport, isNew);

        return outPath;
    }

    protected parseViewport(viewport?: string): Viewport | null {
        if(!viewport) {
            return null;
        }

        const match = /^(\d+)x(\d+)$/.exec(viewport);

        if(!match) {
            throw new Error(`Invalid --viewport "${viewport}", expected WIDTHxHEIGHT (e.g. 1280x800)`);
        }

        return {
            width: Number(match[1]),
            height: Number(match[2])
        };
    }

    protected findTab(pages: Page[], selector: string): Page | undefined {
        if(/^\d+$/.test(selector)) {
            return pages[Number(selector)];
        }

        return pages.find((page) => page.url().includes(selector));
    }

    public async setDefault(name: string): Promise<void> {
        const service = this.config.getService(name);

        this.config.default = service.name;
        this.config.save();
    }
}
