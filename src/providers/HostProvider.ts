import {spawn} from "child_process";
import * as FS from "fs";
import * as Net from "net";
import {Service} from "../makes/Service";
import {BrowserProvider} from "../types/BrowserProvider";
import {BrowserType} from "../types/BrowserType";


export class HostProvider extends BrowserProvider {
    public constructor(
        service: Service,
        protected readonly pidFile: string,
        protected readonly profileDir: string,
        protected readonly logFile: string
    ) {
        super(service);
    }

    public async start(): Promise<void> {
        if(await this.isRunning()) {
            return;
        }

        if(!this.service.path) {
            throw new Error(`Service "${this.service.name}" has no executable path configured`);
        }

        console.info(`Starting ${this.service.name} service...`);

        FS.mkdirSync(this.profileDir, {
            recursive: true
        });

        const args = [
            `--remote-debugging-port=${this.service.port || 3000}`,
            "--remote-debugging-address=127.0.0.1",
            this.service.browser === BrowserType.CHROMIUM
                ? `--user-data-dir=${this.profileDir}`
                : `--profile=${this.profileDir}`
        ];

        if(this.service.headless) {
            args.push("--headless=new");

            if(this.service.browser === BrowserType.CHROMIUM) {
                args.push("--disable-gpu");
            }
        }

        const log = FS.openSync(this.logFile, "a");

        const child = spawn(this.service.path, args, {
            detached: true,
            stdio: ["ignore", log, log]
        });

        child.unref();
        FS.closeSync(log);

        FS.writeFileSync(this.pidFile, `${child.pid}`);

        if(!await this.waitUntilRunning()) {
            throw new Error(`Service "${this.service.name}" didn't come up on port ${this.service.port || 3000}. Check the log: ${this.logFile}`);
        }
    }

    public async stop(): Promise<void> {
        const pid = this.readPid();

        if(pid) {
            try {
                process.kill(pid);
            }
            catch(err) {}
        }

        if(FS.existsSync(this.pidFile)) {
            FS.unlinkSync(this.pidFile);
        }

        // Give Chrome a moment to actually release its profile dir (locks,
        // in-flight writes) before anything tries to delete it — killing the
        // process doesn't mean it's gone yet.
        await this.waitUntilStopped();
    }

    public async remove(): Promise<void> {
        await this.stop();

        FS.rmSync(this.profileDir, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 200
        });
    }

    public async isRunning(): Promise<boolean> {
        if(this.service.browser === BrowserType.FIREFOX) {
            return !!this.getFirefoxWsEndpoint() && await this.isPortOpen(this.service.port || 3000);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1000);

            const res = await fetch(`http://localhost:${this.service.port || 3000}/json/version`, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            return res.ok;
        }
        catch(err) {
            return false;
        }
    }

    public async getCdpUrl(): Promise<string> {
        if(!await this.isRunning()) {
            throw new Error(`Service "${this.service.name}" is not started. Run "ws browser:start" first.`);
        }

        if(this.service.browser === BrowserType.FIREFOX) {
            return this.getFirefoxWsEndpoint() as string;
        }

        return `http://localhost:${this.service.port || 3000}`;
    }

    protected getFirefoxWsEndpoint(): string | undefined {
        if(!FS.existsSync(this.logFile)) {
            return undefined;
        }

        const matches = [...FS.readFileSync(this.logFile, "utf-8").matchAll(/^WebDriver BiDi listening on (ws:\/\/.*)$/gm)];

        return matches.length > 0 ? `${matches[matches.length - 1][1].trim()}/session` : undefined;
    }

    protected isPortOpen(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = Net.createConnection({
                host: "127.0.0.1",
                port,
                timeout: 1000
            });

            const done = (result: boolean) => {
                socket.destroy();
                resolve(result);
            };

            socket.once("connect", () => done(true));
            socket.once("timeout", () => done(false));
            socket.once("error", () => done(false));
        });
    }

    protected async waitUntilRunning(timeoutMs = 10000): Promise<boolean> {
        const start = Date.now();

        while(Date.now() - start < timeoutMs) {
            if(await this.isRunning()) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return false;
    }

    protected async waitUntilStopped(timeoutMs = 5000): Promise<boolean> {
        const start = Date.now();

        while(Date.now() - start < timeoutMs) {
            if(!await this.isRunning()) {
                return true;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return false;
    }

    protected readPid(): number | undefined {
        if(!FS.existsSync(this.pidFile)) {
            return undefined;
        }

        const pid = parseInt(FS.readFileSync(this.pidFile, "utf-8").trim(), 10);

        return isNaN(pid) ? undefined : pid;
    }
}
