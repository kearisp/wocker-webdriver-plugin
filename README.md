# @wocker/cdp-plugin

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
ws browser:list                              # list configured services
ws browser:destroy [service]                 # remove it
ws browser:cdp [service]                     # print the CDP endpoint URL, e.g. http://localhost:3000
ws browser:pages [service]                   # list open tabs (#, title, URL)
ws browser:exec <file> [service]             # run a script file against the browser
ws browser:eval <code> [service]             # run inline JS against the browser
```

### Creating a `local` service

When you pick provider `local` and don't pass `--path`, wocker scans the
machine for installed browsers (Chrome, Chromium, Edge, Brave — checked via
`which` and, on macOS, the usual `.app` locations) and offers them in a
select, plus an **"Enter path manually..."** option:

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
to your code, then close that page and disconnect (never `browser.close()`
— the browser is shared).

- **`exec <file>`** — the file must export an async function:

  ```js
  // screenshot.js
  module.exports = async (page) => {
      await page.goto("http://localhost:5173");
      await page.waitForSelector("text=Dashboard");
      await page.screenshot({path: "screenshot.png"});
  };
  ```

  ```shell
  ws browser:exec screenshot.js
  ```

- **`eval <code>`** — `code` is the *body* of an async function, `page` is
  in scope:

  ```shell
  ws browser:eval "await page.goto('http://localhost:5173'); return await page.title();"
  ```

  If your code doesn't `await`/`return` a promise (e.g. a bare
  `page.goto(...)`), it gets aborted when the page closes right after — the
  command won't crash, but you'll see a warning on stderr instead of a
  result.

### Working with a tab you already have open

By default `exec`/`eval` open a fresh, throwaway tab. If you'd rather have
the agent pick up a tab you already have open and authenticated (so it
doesn't need to log in itself), list tabs and target one with `--tab`:

```shell
ws browser:pages
# ┌───┬────────────────┬────────────────────────┐
# │ # │ Title          │ URL                     │
# ├───┼────────────────┼────────────────────────┤
# │ 0 │ My Dashboard    │ https://app.local/home  │
# └───┴────────────────┴────────────────────────┘

ws browser:eval --tab 0 "return await page.title();"
ws browser:eval --tab app.local "return await page.title();"   # or match by a substring of the URL
```

A tab targeted with `--tab` is left open afterwards — only tabs `exec`/`eval`
create themselves get closed.

### Ports

`container`/`local` both listen directly on the host (Docker host networking
for the former, a plain local process for the latter), so only one service
can use a given port at a time. The default service needs no port
configuration; pass `--port` to `browser:create`/`browser:upgrade` only if
you need to run more than one browser service side by side.

## Documentation

Wocker is a powerful tool for managing your web project's Docker workspace. It provides a convenient and efficient way to set up and manage your Docker containers.

For more information and detailed usage, please refer to the [documentation](https://kearisp.github.io/wocker).
