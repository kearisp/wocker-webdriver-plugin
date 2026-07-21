import {spawn} from "child_process";
import * as FS from "fs";
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
                : `--profile=${this.profileDir}`,
            // "--no-sandbox",
            "--disable-gpu"
        ];

        if(this.service.headless) {
            args.push("--headless=new");
        }

        const log = FS.openSync(this.logFile, "a");

        const child = spawn(this.service.path, args, {
            detached: true,
            // The PID we get back isn't reliably the browser's final PID (the
            // executable may re-exec/daemonize under a different one), so it's
            // only good enough for a best-effort `stop()` — actual "is it up"
            // has to be a real CDP check, see isRunning().
            stdio: ["ignore", log, log]
        });

        console.log(">_<");

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

        return `http://localhost:${this.service.port || 3000}`;
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
