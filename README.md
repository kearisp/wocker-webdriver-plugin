# @wocker/webdriver-plugin

###### Docker workspace for web projects

Gives you a persistent headless browser reachable over the Chrome DevTools
Protocol (CDP), via one of three providers (`src/providers`, all implementing
the `BrowserProvider` contract — `start`/`stop`/`remove`/`isRunning`/`getCdpUrl`):

- **`container`** (default) — `ContainerProvider` starts and manages a
  `browserless/chrome` Docker container with host networking, so its CDP
  endpoint is reachable at a fixed `http://localhost:<port>` address.
- **`local`** — `HostProvider` spawns a browser executable already
  installed on this machine (e.g. `/usr/bin/google-chrome`), tracking it
  across CLI invocations. Health/readiness is checked via a real CDP request
  (`/json/version`), not by trusting a PID, since a browser's own PID isn't
  reliably the one that ends up serving CDP. No Docker involved.
- **`url`** — `UrlProvider` points at a browser that's already running
  somewhere else; wocker doesn't manage its lifecycle at all, only stores
  its CDP URL.

The point is to give any tool that needs to drive a browser — an agent's
test runner, a screenshot script, etc. — a shared, already-running browser,
without every project installing and downloading its own Puppeteer/
Playwright browser binary. The plugin bundles its own `puppeteer-core` and
exposes it through `browser:eval`/`browser:exec`, so scripts don't need any
browser-related dependency of their own either.

## Installation

**Note:** It is recommended to install Wocker globally to ensure accessibility from any directory in your terminal.

```shell
npm i -g @wocker/ws
```

```shell
ws plugin:install webdriver
```

### Completion

Wocker comes with shell completion support to enhance your development workflow. To enable shell completion, run the following command:

```bash
source <(ws completion script)
```

This will enable tab completion for `ws` commands, providing a more convenient and efficient way to interact with the tool.

## Usage

```shell
ws browser:create                            # create a service (prompts for name, provider, ...)
ws browser:create --provider local           # prompts a select of auto-detected browsers, or manual path entry
ws browser:create --provider local --path /usr/bin/google-chrome --headful
ws browser:create --provider url --url http://192.168.1.10:9222
ws browser:start [service]                   # start it (container/local providers only)
ws browser:stop [service]                    # stop it (container/local providers only)
ws browser:use [service]                     # set/print the default service
ws browser:list                              # list configured services
ws browser:destroy [service]                 # remove it
ws browser:cdp [service]                     # print the CDP endpoint URL, e.g. http://localhost:3000
ws browser:pages [service]                   # list open tabs (#, active marker, title, URL)
ws browser:exec <file> [service]             # run a script file against the browser
ws browser:eval <code> [service]             # run inline JS against the browser
ws browser:screenshot [service]              # screenshot a page (or --selector) to disk
ws browser:hide [service]                    # hide the browser window (local provider only)
ws browser:show [service]                    # show it again
```

### Creating a `local` service

When you pick provider `local` and don't pass `--path`, wocker scans the
machine for installed browsers (Chrome, Chromium, Edge, Brave — checked via
`which` and, on macOS, the usual `.app` locations) and offers them in a
select, plus wan **"Enter path manually..."** option:

```shell
ws browser:create --provider local
# ? Browser:
#   Google Chrome (/usr/bin/google-chrome-stable)
#   Enter path manually...
```

Pass `--path` to skip the prompt entirely (useful for scripting/CI).

By default the browser runs **headless**. Pass `--headful` at
`browser:create`/`browser:upgrade` to open a real, visible window instead
(handy when you want to watch what the browser/agent is doing, or hand off
an authenticated session — see below). `--headless` is also available to
force it back on.

### `browser:exec` vs `browser:eval`

Both connect via the plugin's own `puppeteer-core`, hand a Puppeteer `page`
and a `helper` object (see "Project helper" below) to your code, then
disconnect (never `browser.close()` — the browser is shared). The page
itself is **never closed** — whatever tab was used (the active tab, a
`--tab` you picked, or a `--new` one) stays open afterwards.

- **`exec <file>`** — the file must export an async function:

  ```js
  // screenshot.js
  module.exports = async (page, helper) => {
      await page.goto("http://localhost:5173");
      await page.waitForSelector("text=Dashboard");
      await page.screenshot({path: "screenshot.png"});
  };
  ```

  ```shell
  ws browser:exec screenshot.js
  ```

- **`eval <code>`** — `code` is the *body* of an async function, `page` and
  `helper` are in scope:

  ```shell
  ws browser:eval "await page.goto('http://localhost:5173'); return await page.title();"
  ```

  If your code doesn't `await`/`return` a promise (e.g. a bare
  `page.goto(...)`), it gets aborted when the connection to the browser
  disconnects right after — the command won't crash, but you'll see a
  warning on stderr instead of a result.

### Project helper

Scripts running via `browser:exec`/`browser:eval` often need the current
project's env vars, metadata, or secrets — e.g. to know which URL to hit, a
feature flag, or a password without that password ever becoming a plaintext
value the script itself can read, print, or accidentally leak. The second
argument passed to your handler, `helper`, gives access to all three, scoped
to the project you run the command from (the same project `ws config`,
`ws meta`, and `ws secret:*` operate on):

```ts
type ProjectHelper = {
    getEnv(key: string, byDefault?: string): string | undefined;
    hasEnv(key: string): boolean;

    getMeta(key: string, byDefault?: string): string | undefined;
    hasMeta(key: string): boolean;

    generatePassword(name: string, length?: number): Promise<void>;
    setSecret(name: string, value: string): Promise<void>;
    hasSecret(name: string): Promise<boolean>;
    fillWithSecret(selector: string, name: string): Promise<void>;
};
```

`getEnv`/`getMeta` return the value directly — same as `ws config:get`/
`ws meta`. Secrets are handled more carefully: `generatePassword`/`setSecret`
never return the value — it's generated (or accepted) and stored entirely
host-side, as a real project secret (the same one `ws secret:create`/
`ws secret:inspect`/`ws secret:rm` manage). `fillWithSecret(selector, name)`
is the only way a script *uses* a secret: it resolves the value and types it
into a form field directly, without ever handing the plaintext back to your
code as a variable. There is deliberately no method that returns a secret's
plaintext to the script.

A registration flow might look like:

```shell
ws browser:eval "
    await page.goto(helper.getEnv('SIGNUP_URL', 'https://example.com/signup'));
    await helper.generatePassword('example_com_login');
    await page.type('#email', 'agent@example.com');
    await helper.fillWithSecret('#password', 'example_com_login');
    await page.click('#submit');
    return 'registered';
"
```

As a safety net, any secret value a `fillWithSecret` call resolves during a
single `exec`/`eval` invocation is also scrubbed (exact-substring match)
from that invocation's own stdout/stderr and its return value — in case a
page echoes a value back into its own content and the script reads or logs
it. This isn't foolproof (a re-encoded copy of the value won't be caught,
and screenshots aren't redacted), but it catches the common accidental case.

Manage the underlying project env/meta/secrets from the CLI directly:

```shell
ws config:set SIGNUP_URL https://example.com/signup
ws meta:set ab_profile b
ws secret:create example_com_login   # prompts for the value
ws secret:inspect example_com_login
ws secret:rm example_com_login
```

### Which tab gets used

`exec`, `eval`, and `screenshot` all target a tab, picked in this order:

- **default (no `--tab`/`--new`)** — the currently **active** tab, i.e. the
  one in the foreground of the browser window. This is what you want when
  the agent should pick up a tab you (or a previous command) already have
  open and authenticated, without needing to log in itself.
- **`--tab <index|url-substring>`** — a specific open tab, by index (see
  `ws browser:pages`) or a substring of its URL.
- **`--new`** — always open a fresh tab instead.

```shell
ws browser:pages
# ┌───┬────────┬────────────────┬────────────────────────┐
# │ # │ Active │ Title          │ URL                     │
# ├───┼────────┼────────────────┼────────────────────────┤
# │ 0 │ *      │ My Dashboard   │ https://app.local/home  │
# └───┴────────┴────────────────┴────────────────────────┘

ws browser:eval "return await page.title();"                   # active tab
ws browser:eval --tab 0 "return await page.title();"            # by index
ws browser:eval --tab app.local "return await page.title();"    # by URL substring
ws browser:eval --new "return await page.title();"              # always a fresh tab
```

`--tab` and `--new` are mutually exclusive. No tab is ever closed
automatically — whichever one gets used stays open after the command
finishes.

### Ports

`container`/`local` both listen directly on the host (Docker host networking
for the former, a plain local process for the latter), so only one service
can use a given port at a time. The default service needs no port
configuration; pass `--port` to `browser:create`/`browser:upgrade` only if
you need to run more than one browser service side by side.

## Documentation

Wocker is a powerful tool for managing your web project's Docker workspace. It provides a convenient and efficient way to set up and manage your Docker containers.

For more information and detailed usage, please refer to the [documentation](https://kearisp.github.io/wocker).
