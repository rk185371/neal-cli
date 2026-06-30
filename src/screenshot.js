const { execFile } = require('child_process');
const { promisify } = require('util');
const { createInterface } = require('readline');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

function promptChoice(label, items, formatItem) {
    return new Promise((resolve) => {
        console.log(`${label}:`);
        items.forEach((item, i) => {
            console.log(`  [${i + 1}] ${formatItem(item)}`);
        });
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`Choose (1-${items.length}): `, (answer) => {
            rl.close();
            const idx = parseInt(answer, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= items.length) {
                console.error('Invalid selection.');
                process.exit(1);
            }
            resolve(items[idx]);
        });
    });
}

/**
 * Parse GetWindowID --list output into structured window objects.
 * Each line looks like: "Inbox - Gmail" size=1728x1080 id=73841
 */
function parseWindowList(stdout) {
    const lines = stdout.trim().split('\n').filter(Boolean);
    const windows = [];
    const re = /^"(.+?)"\s+size=(\d+)x(\d+)\s+id=(\d+)$/;
    for (const line of lines) {
        const m = line.match(re);
        if (!m) continue;
        const width = parseInt(m[2], 10);
        const height = parseInt(m[3], 10);
        if (width === 0 || height === 0) continue;
        windows.push({ title: m[1], width, height, id: m[4] });
    }
    return windows;
}

function filterByTitle(windows, substr) {
    const lower = substr.toLowerCase();
    return windows.filter(w => w.title.toLowerCase().includes(lower));
}

function pickLargest(windows) {
    return windows.reduce((best, w) =>
        (w.width * w.height > best.width * best.height) ? w : best
    );
}

async function listWindows(app) {
    try {
        const { stdout } = await execFileAsync('GetWindowID', [app, '--list']);
        return parseWindowList(stdout);
    } catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error(
                'GetWindowID not found. Install it with:\n  brew install smokris/getwindowid/getwindowid'
            );
        }
        throw new Error(`GetWindowID failed: ${err.stderr || err.message}`);
    }
}

async function getRunningApps() {
    try {
        const { stdout } = await execFileAsync('osascript', [
            '-e',
            'tell application "System Events" to get name of every process whose background only is false'
        ]);
        return stdout.trim().split(', ').sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } catch (err) {
        throw new Error(`Failed to list applications: ${err.stderr || err.message}`);
    }
}

function printApps(apps) {
    console.log('Running applications:');
    apps.forEach((name, i) => {
        console.log(`  [${i + 1}] ${name}`);
    });
}

function defaultOutputPath(app, win) {
    const now = new Date();
    const dateDir = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const normalized = `${app}-${win.title}-${timestamp}`
        .toLowerCase()
        .replace(/[/\\:*?"<>|]/g, '_')  // strip filesystem-unsafe chars
        .replace(/\s+/g, '-')           // spaces → hyphens
        .replace(/-{2,}/g, '-')         // collapse multiple hyphens
        .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
    const skillDir = path.resolve(__dirname, '..', 'skills', 'neal-cli');
    const cacheDir = path.join(skillDir, '.cache', dateDir);
    fs.mkdirSync(cacheDir, { recursive: true });
    return path.join(cacheDir, `${normalized}.png`);
}

function fullScreenOutputPath() {
    const now = new Date();
    const dateDir = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const normalized = `fullscreen-${timestamp}`;
    const skillDir = path.resolve(__dirname, '..', 'skills', 'neal-cli');
    const cacheDir = path.join(skillDir, '.cache', dateDir);
    fs.mkdirSync(cacheDir, { recursive: true });
    return path.join(cacheDir, `${normalized}.png`);
}

async function captureFullScreen(outputPath) {
    const dest = outputPath || fullScreenOutputPath();

    try {
        await execFileAsync('screencapture', ['-x', '-o', dest]);
    } catch (err) {
        throw new Error(`screencapture failed: ${err.stderr || err.message}`);
    }

    try {
        const stat = fs.statSync(dest);
        if (stat.size === 0) throw new Error('empty');
    } catch {
        console.error(
            'Screenshot file is missing or empty. Screen Recording permission is likely denied.\n' +
            'Grant permission to your terminal in:\n' +
            '  System Settings → Privacy & Security → Screen Recording\n' +
            'Then restart the terminal.'
        );
        process.exit(1);
    }

    console.log(`Saved: ${dest}  (full screen)`);
}

async function captureWindow(app, win, outputPath) {
    const dest = outputPath || defaultOutputPath(app, win);

    try {
        await execFileAsync('screencapture', [`-l${win.id}`, '-x', '-o', dest]);
    } catch (err) {
        throw new Error(`screencapture failed: ${err.stderr || err.message}`);
    }

    // screencapture exits 0 but writes nothing when Screen Recording is denied
    try {
        const stat = fs.statSync(dest);
        if (stat.size === 0) throw new Error('empty');
    } catch {
        console.error(
            'Screenshot file is missing or empty. Screen Recording permission is likely denied.\n' +
            'Grant permission to your terminal in:\n' +
            '  System Settings → Privacy & Security → Screen Recording\n' +
            'Then restart the terminal.'
        );
        process.exit(1);
    }

    console.log(`Saved: ${dest}  (window "${win.title}", ${win.width}x${win.height})`);
}

async function screenshot(app, options) {
    const interactive = options.interactive !== false;

    if (options.apps) {
        const apps = await getRunningApps();
        printApps(apps);
        return;
    }

    // Resolve app name
    if (!app) {
        if (interactive) {
            const apps = await getRunningApps();
            const choices = ['⌕ Full Screen', ...apps];
            const chosen = await promptChoice('Screenshot target', choices, (name) => name);
            if (chosen === '⌕ Full Screen') {
                await captureFullScreen(options.output);
                return;
            }
            app = chosen;
        } else {
            console.error('Missing required argument: <app>. Use --apps to list available application names.');
            process.exit(1);
        }
    }

    let windows = await listWindows(app);

    if (options.title) {
        windows = filterByTitle(windows, options.title);
    }

    // Handle no windows found
    if (windows.length === 0) {
        const extra = options.title ? ` with title containing "${options.title}"` : '';
        console.error(`No windows found for "${app}"${extra}.`);
        if (interactive) {
            const apps = await getRunningApps();
            app = await promptChoice('Running applications', apps, (name) => name);
            windows = await listWindows(app);
            if (options.title) {
                windows = filterByTitle(windows, options.title);
            }
            if (windows.length === 0) {
                console.error(`No capturable windows for "${app}".`);
                process.exit(1);
            }
        } else {
            process.exit(1);
        }
    }

    if (options.list) {
        console.log(`Windows for "${app}":`);
        for (const w of windows) {
            console.log(`  id=${w.id}  ${w.width}x${w.height}  "${w.title}"`);
        }
        return;
    }

    if (interactive) {
        // Interactive: pick one window (skip prompt if only one)
        const win = windows.length === 1
            ? windows[0]
            : await promptChoice('Multiple windows found', windows, (w) => `${w.width}x${w.height}  "${w.title}"`);
        await captureWindow(app, win, options.output);
    } else {
        // Non-interactive: capture all matching windows
        if (windows.length === 1 && options.output) {
            await captureWindow(app, windows[0], options.output);
        } else {
            for (const win of windows) {
                await captureWindow(app, win, null);
            }
        }
    }
}

module.exports = { screenshot };
