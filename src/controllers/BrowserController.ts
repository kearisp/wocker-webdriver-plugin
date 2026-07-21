import {
    Controller,
    Command,
    Description,
    Completion,
    Option,
    Param
} from "@wocker/core";
import {AppConfigService, DockerService} from "@wocker/core";
import {BrowserService} from "../services/BrowserService";
import {ProviderType} from "../types/ProviderType";


@Controller()
@Description("Browser commands")
export class BrowserController {
    public constructor(
        protected readonly appConfigService: AppConfigService,
        protected readonly dockerService: DockerService,
        protected readonly browserService: BrowserService
    ) {}

    @Command("browser:create [service]")
    @Description("Creates a headless browser service with a configurable provider (container, local, url).")
    public async create(
        @Param("service")
        name?: string,
        @Option("provider", {
            type: "string",
            alias: "p",
            description: `Browser provider (${ProviderType.values().join(", ")})`
        })
        provider?: ProviderType,
        @Option("url", {
            type: "string",
            description: "CDP URL of an already-running browser (used when provider is \"url\")"
        })
        url?: string,
        @Option("path", {
            type: "string",
            description: "Path to the browser executable (used when provider is \"local\")"
        })
        path?: string,
        @Option("image", {
            type: "string",
            alias: "i",
            description: "The image name to start the service with (used when provider is \"container\")"
        })
        image?: string,
        @Option("port")
        @Description("Port the browser listens on")
        port?: number,
        @Option("headless", {
            type: "boolean",
            description: "Run the browser headless (used when provider is \"local\"; default: on)"
        })
        headless?: boolean,
        @Option("headful", {
            type: "boolean",
            description: "Run the browser with a visible window instead of headless (used when provider is \"local\")"
        })
        headful?: boolean
    ): Promise<void> {
        await this.browserService.create({
            name,
            provider,
            url,
            path,
            image,
            port,
            headless: headful ? false : headless
        });
    }

    @Command("browser:destroy [service]")
    @Description("Destroys a specified browser service instance with an option to force deletion.")
    public async destroy(
        @Param("service")
        service?: string,
        @Option("force", {
            type: "boolean",
            alias: "f",
            description: "Force deletion"
        })
        force?: boolean,
        @Option("yes", {
            type: "boolean",
            alias: "y",
            description: "Skip confirmation"
        })
        yes?: boolean
    ): Promise<void> {
        await this.browserService.destroy(service, yes, force);
    }

    @Command("browser:upgrade [name]")
    @Description("Updates the provider, image, path, url, or port configuration of a browser service.")
    public async upgrade(
        @Param("name")
        name?: string,
        @Option("provider", {
            type: "string",
            alias: "p",
            description: `Browser provider (${ProviderType.values().join(", ")})`
        })
        provider?: ProviderType,
        @Option("url", {
            type: "string",
            description: "CDP URL of an already-running browser (used when provider is \"url\")"
        })
        url?: string,
        @Option("path", {
            type: "string",
            description: "Path to the browser executable (used when provider is \"local\")"
        })
        path?: string,
        @Option("image", {
            type: "string",
            alias: "i"
        })
        image?: string,
        @Option("port")
        @Description("Port the browser listens on")
        port?: number,
        @Option("headless", {
            type: "boolean",
            description: "Run the browser headless (used when provider is \"local\")"
        })
        headless?: boolean,
        @Option("headful", {
            type: "boolean",
            description: "Run the browser with a visible window instead of headless (used when provider is \"local\")"
        })
        headful?: boolean
    ): Promise<void> {
        await this.browserService.upgrade({
            name,
            provider,
            url,
            path,
            image,
            port,
            headless: headful ? false : headless
        });
    }

    @Command("browser:use [service]")
    @Description("Sets a specified browser service as the default or retrieves the current default service name if no service is specified.")
    public async default(
        @Param("service")
        service?: string
    ): Promise<string | undefined> {
        if(!service) {
            const data = this.browserService.config.getDefaultService();

            return `${data.name}\n`;
        }

        await this.browserService.setDefault(service);
    }

    @Command("browser:start [service]")
    @Description("Starts a specified browser service and optionally restarts it if already running.")
    public async start(
        @Param("service")
        service?: string,
        @Option("restart", {
            type: "boolean",
            alias: "r",
            description: "Restart the service if already running"
        })
        restart?: boolean
    ): Promise<void> {
        await this.browserService.start(service, restart);
    }

    @Command("browser:stop [service]")
    @Description("Stops a specified browser service instance.")
    public async stop(
        @Param("service")
        service?: string
    ): Promise<void> {
        await this.browserService.stop(service);
    }

    @Command("browser:ls")
    @Command("browser:list")
    @Description("Lists all browser services.")
    public async list(): Promise<string> {
        return this.browserService.list();
    }

    @Command("browser:cdp [service]")
    @Description("Prints the CDP endpoint URL of a running browser service, for connecting via connectOverCDP.")
    public async cdp(
        @Param("service")
        service?: string
    ): Promise<string> {
        return `${await this.browserService.cdp(service)}\n`;
    }

    @Command("browser:exec <file> [service]")
    @Description("Runs a script file against the browser service using the plugin's own puppeteer-core. The file must export an async function receiving the Puppeteer `page`.")
    public async exec(
        @Param("file")
        file: string,
        @Param("service")
        service?: string,
        @Option("tab", {
            type: "string",
            description: "Attach to an already-open tab instead of a new one — by index (see browser:pages) or a substring of its URL. The tab is left open afterwards."
        })
        tab?: string
    ): Promise<string | undefined> {
        return this.formatResult(await this.browserService.exec(file, service, tab));
    }

    @Command("browser:eval <code> [service]")
    @Description("Runs inline JS against the browser service using the plugin's own puppeteer-core. `code` is the body of an async function receiving `page`, e.g. \"await page.goto('...'); return await page.title();\"")
    public async eval(
        @Param("code")
        code: string,
        @Param("service")
        service?: string,
        @Option("tab", {
            type: "string",
            description: "Attach to an already-open tab instead of a new one — by index (see browser:pages) or a substring of its URL. The tab is left open afterwards."
        })
        tab?: string
    ): Promise<string | undefined> {
        return this.formatResult(await this.browserService.eval(code, service, tab));
    }

    @Command("browser:pages [service]")
    @Description("Lists open tabs in a running browser service (title, URL) — use an index or URL substring with --tab on exec/eval to attach to one instead of opening a new tab.")
    public async pages(
        @Param("service")
        service?: string
    ): Promise<string> {
        return this.browserService.pages(service);
    }

    protected formatResult(result: unknown): string | undefined {
        if(typeof result === "undefined") {
            return;
        }

        return typeof result === "string" ? result : JSON.stringify(result, null, 2);
    }

    @Completion("service", "browser:create [service]")
    public getEmp(): string[] {
        return [];
    }

    @Completion("provider")
    public getProviders(): string[] {
        return ProviderType.values();
    }

    @Completion("service")
    public getExistsServices(): string[] {
        return this.browserService.getServices();
    }
}
