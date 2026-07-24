import * as FS from "fs";
import koffi from "koffi";


const XA_CARDINAL = 6; // predefined X11 atom, see X11/Xatom.h

const xlib = koffi.load("libX11.so.6");

const XOpenDisplay = xlib.func("void *XOpenDisplay(const char *display_name)");
const XDefaultRootWindow = xlib.func("unsigned long XDefaultRootWindow(void *display)");
const XFree = xlib.func("int XFree(void *data)");
const XSync = xlib.func("int XSync(void *display, bool discard)");
const XUnmapWindow = xlib.func("int XUnmapWindow(void *display, unsigned long w)");
const XMapWindow = xlib.func("int XMapWindow(void *display, unsigned long w)");
const XInternAtom = xlib.func("unsigned long XInternAtom(void *display, const char *atom_name, bool only_if_exists)");

const XQueryTree = xlib.func(
    "int XQueryTree(void *display, unsigned long w, _Out_ unsigned long *root_return, " +
    "_Out_ unsigned long *parent_return, _Out_ unsigned long **children_return, " +
    "_Out_ unsigned int *nchildren_return)"
);

const XGetWindowProperty = xlib.func(
    "int XGetWindowProperty(void *display, unsigned long w, unsigned long property, " +
    "long long_offset, long long_length, bool delete_, unsigned long req_type, " +
    "_Out_ unsigned long *actual_type_return, _Out_ int *actual_format_return, " +
    "_Out_ unsigned long *nitems_return, _Out_ unsigned long *bytes_after_return, " +
    "_Out_ void **prop_return)"
);

function openDisplay(): unknown {
    const name = process.env.DISPLAY || ":0";
    const dpy = XOpenDisplay(name);

    if(!dpy) {
        throw new Error(`Cannot open X display "${name}". Is this running inside a graphical (WSLg/X11) session?`);
    }

    return dpy;
}

function queryTree(dpy: unknown, win: number): number[] {
    const root = [0], parent = [0], children = [null], nchildren = [0];

    XQueryTree(dpy, win, root, parent, children, nchildren);

    const count = nchildren[0];

    if(count === 0 || !children[0]) {
        return [];
    }

    // koffi's array-length decode (decode(ptr, type, count)) misreads 8-byte
    // integers as raw IEEE-754 doubles for this type; decoding element by
    // element via a byte offset uses a codepath that reads them correctly.
    const result: number[] = [];

    for(let i = 0; i < count; i++) {
        result.push(Number(koffi.decode(children[0], i * 8, "uint64_t")));
    }

    XFree(children[0]);

    return result;
}

function findAllWindows(dpy: unknown, win: number, depth = 0, maxDepth = 4): number[] {
    const found: number[] = [];

    if(depth > maxDepth) {
        return found;
    }

    for(const child of queryTree(dpy, win)) {
        found.push(child);
        found.push(...findAllWindows(dpy, child, depth + 1, maxDepth));
    }

    return found;
}

function getNetWmPid(dpy: unknown, win: number): number | undefined {
    const atom = XInternAtom(dpy, "_NET_WM_PID", false);
    const actualType = [0], actualFormat = [0], nitems = [0], bytesAfter = [0], prop = [null];

    const result = XGetWindowProperty(
        dpy, win, atom,
        0, 1, false, XA_CARDINAL,
        actualType, actualFormat, nitems, bytesAfter, prop
    );

    if(result !== 0 || !prop[0] || nitems[0] === 0) {
        return undefined;
    }

    const value = koffi.decode(prop[0], "uint64_t");

    XFree(prop[0]);

    return Number(value);
}

// The browser's top-level window is owned by the exact PID we launched in
// this plugin's case, but matching descendants too makes this resilient to
// browsers/setups where the window ends up owned by a child process.
function descendantPids(rootPid: number): Set<number> {
    const parents = new Map<number, number[]>();

    for(const entry of FS.readdirSync("/proc")) {
        if(!/^\d+$/.test(entry)) {
            continue;
        }

        let ppid: number;

        try {
            const stat = FS.readFileSync(`/proc/${entry}/stat`, "utf-8");

            ppid = parseInt(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1], 10);
        }
        catch(err) {
            continue;
        }

        const siblings = parents.get(ppid) || [];

        siblings.push(parseInt(entry, 10));
        parents.set(ppid, siblings);
    }

    const result = new Set<number>([rootPid]);
    const stack = [rootPid];

    while(stack.length > 0) {
        const pid = stack.pop() as number;

        for(const child of parents.get(pid) || []) {
            if(!result.has(child)) {
                result.add(child);
                stack.push(child);
            }
        }
    }

    return result;
}

function findWindowsByPid(dpy: unknown, pid: number): number[] {
    const pids = descendantPids(pid);
    const root = XDefaultRootWindow(dpy);

    return findAllWindows(dpy, root).filter((win) => {
        const wpid = getNetWmPid(dpy, win);

        return wpid !== undefined && pids.has(wpid);
    });
}

function toggle(pid: number, visible: boolean): number {
    const dpy = openDisplay();
    const windows = findWindowsByPid(dpy, pid);

    if(windows.length === 0) {
        throw new Error(`No X11 window found for pid ${pid} (or its child processes). Is the browser actually showing a window?`);
    }

    for(const win of windows) {
        if(visible) {
            XMapWindow(dpy, win);
        }
        else {
            XUnmapWindow(dpy, win);
        }
    }

    XSync(dpy, false);

    return windows.length;
}

export function hideWindowByPid(pid: number): number {
    return toggle(pid, false);
}

export function showWindowByPid(pid: number): number {
    return toggle(pid, true);
}
