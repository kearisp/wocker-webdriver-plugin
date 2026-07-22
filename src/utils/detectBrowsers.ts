import {execFileSync} from "child_process";
import * as FS from "fs";


export type DetectedBrowser = {
    name: string;
    path: string;
};

type Candidate = {
    name: string;
    commands?: string[];
    paths?: string[];
};

const CANDIDATES: Candidate[] = [
    {
        name: "Google Chrome",
        commands: ["google-chrome-stable", "google-chrome"],
        paths: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    },
    {
        name: "Chromium",
        commands: ["chromium-browser", "chromium"],
        paths: ["/Applications/Chromium.app/Contents/MacOS/Chromium"]
    },
    {
        name: "Microsoft Edge",
        commands: ["microsoft-edge-stable", "microsoft-edge"],
        paths: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    },
    {
        name: "Brave",
        commands: ["brave-browser", "brave"],
        paths: ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"]
    }
];

function which(command: string): string | undefined {
    try {
        const resolved = execFileSync("which", [command], {
            stdio: ["ignore", "pipe", "ignore"]
        }).toString().trim();

        return resolved || undefined;
    }
    catch(err) {
        return undefined;
    }
}

export function detectBrowsers(): DetectedBrowser[] {
    const seen = new Set<string>();
    const found: DetectedBrowser[] = [];

    for(const candidate of CANDIDATES) {
        let resolved: string | undefined;

        for(const command of candidate.commands || []) {
            resolved = which(command);

            if(resolved) {
                break;
            }
        }

        if(!resolved) {
            resolved = (candidate.paths || []).find((path) => FS.existsSync(path));
        }

        if(!resolved) {
            continue;
        }

        const real = FS.realpathSync(resolved);

        if(seen.has(real)) {
            continue;
        }

        seen.add(real);
        found.push({
            name: candidate.name,
            path: resolved
        });
    }

    return found;
}
