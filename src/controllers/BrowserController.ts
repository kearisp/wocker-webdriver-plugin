import {
    Controller,
    Command,
    Description,
    Completion,
    Option,
    Param,
    DockerService
} from "@wocker/core";
import {BrowserService} from "../services/BrowserService";
import {ProviderType} from "../types/ProviderType";


@Controller()
@Description("Browser commands")
export class BrowserController {
    public constructor(
        protected readonly dockerService: DockerService,
        protected readonly browserService: BrowserService
    ) {}

    @Command("browser:create [service]")
    @Description("Creates a headless browser service with a configurable provider (container, host, url).")
    public async create(
        @Param("service")
        name?: string,
        @Option("provider", "p")
        @Description(`Browser provider (${ProviderType.values().join(", ")})`)
        provider?: ProviderType,
        @Option("url")
        @Description("CDP URL of an already-running browser (used when provider is \"url\")")
        url?: string,
        @Option("path")
        @Description("Path to the browser executable (used when provider is \"host\")")
        path?: string,
        @Option("image", "i")
        @Description("The image name to start the service with (used when provider is \"container\")")
        image?: string,
        @Option("port")
        @Description("Port the browser listens on")
        port?: number,
        @Option("headless")
        @Description("Run the browser headless (used when provider is \"host\"; default: on)")
        headless?: boolean,
        @Option("headful")
        @Description("Run the browser with a visible window instead of headless (used when provider is \"host\")")
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
        @Option("force", "f")
        @Description("Force deletion")
        force?: boolean,
        @Option("yes", "y")
        @Description("Skip confirmation")
        yes?: boolean
    ): Promise<void> {
        await this.browserService.destroy(service, yes, force);
    }

    @Command("browser:upgrade [name]")
    @Description("Updates the provider, image, path, url, or port configuration of a browser service.")
    public async upgrade(
        @Param("name")
        name?: string,
        @Option("provider", "p")
        @Description(`Browser provider (${ProviderType.values().join(", ")})`)
        provider?: ProviderType,
        @Option("url")
        @Description("CDP URL of an already-running browser (used when provider is \"url\")")
        url?: string,
        @Option("path")
        @Description("Path to the browser executable (used when provider is \"host\")")
        path?: string,
        @Option("image", "i")
        image?: string,
        @Option("port")
        @Description("Port the browser listens on")
        port?: number,
        @Option("headless")
        @Description("Run the browser headless (used when provider is \"host\")")
        headless?: boolean,
        @Option("headful")
        @Description("Run the browser with a visible window instead of headless (used when provider is \"host\")")
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
        @Option("restart", "r")
        @Description("Restart the service if already running")
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
        @Option("tab", "t")
        @Description("Attach to an already-open tab instead of a new one — by index (see browser:pages) or a substring of its URL. The tab is left open afterwards.")
        tab?: string,
        @Option("viewport", "v")
        @Description("Viewport size as WIDTHxHEIGHT, e.g. 1280x800 (default: match the window's own size)")
        viewport?: string
    ): Promise<string | undefined> {
        return this.formatResult(await this.browserService.exec(file, service, tab, viewport));
    }

    @Command("browser:eval <code> [service]")
    @Description("Runs inline JS against the browser service using the plugin's own puppeteer-core. `code` is the body of an async function receiving `page`, e.g. \"await page.goto('...'); return await page.title();\"")
    public async eval(
        @Param("code")
        code: string,
        @Param("service")
        service?: string,
        @Option("tab", "t")
        @Description("Attach to an already-open tab instead of a new one — by index (see browser:pages) or a substring of its URL. The tab is left open afterwards.")
        tab?: string,
        @Option("viewport", "v")
        @Description("Viewport size as WIDTHxHEIGHT, e.g. 1280x800 (default: match the window's own size)")
        viewport?: string
    ): Promise<string | undefined> {
        return this.formatResult(await this.browserService.eval(code, service, tab, viewport));
    }

    @Command("browser:pages [service]")
    @Description("Lists open tabs in a running browser service (title, URL) — use an index or URL substring with --tab on exec/eval to attach to one instead of opening a new tab.")
    public async pages(
        @Param("service")
        service?: string
    ): Promise<string> {
        return this.browserService.pages(service);
    }

    @Command("browser:screenshot [service]")
    @Description("Takes a screenshot of a page (or a single element via --selector) and saves it to disk. Defaults to /tmp/screenshot-<timestamp>.png.")
    public async screenshot(
        @Param("service")
        service?: string,
        @Option("tab", "t")
        @Description("Attach to an already-open tab instead of a new one — by index (see browser:pages) or a substring of its URL. The tab is left open afterwards.")
        tab?: string,
        @Option("selector", "s")
        @Description("CSS selector of a single element to screenshot instead of the whole page")
        selector?: string,
        @Option("out", "o")
        @Description("File to save the screenshot to (image format is inferred from the extension); defaults to /tmp/screenshot-<timestamp>.png")
        out?: string,
        @Option("fullpage", "f")
        @Description("Capture the full scrollable page instead of just the visible viewport (ignored with --selector)")
        fullpage?: boolean,
        @Option("viewport", "v")
        @Description("Viewport size as WIDTHxHEIGHT, e.g. 1280x800 (default: match the window's own size)")
        viewport?: string
    ): Promise<string> {
        const path = await this.browserService.screenshot(service, tab, selector, out, fullpage, viewport);

        return `Saved screenshot to ${path}\n`;
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
