const { promptChoice, printApps } = require('./ui/prompt');
const { listWindows, getRunningApps } = require('./windows/discovery');
const { filterByTitle } = require('./windows/filter');
const { captureWindow } = require('./capture/window');
const { captureFullScreen } = require('./capture/fullscreen');
const { extractText } = require('../tesseract');
const { jsonOk, info } = require('../output');

async function ocrFile(filePath) {
    const text = await extractText(filePath);
    return text;
}

async function screenshot(app, options) {
    // Auto-detect: disable interactive when stdin is not a TTY
    const interactive = options.interactive !== false && process.stdin.isTTY;

    if (options.apps) {
        const apps = await getRunningApps();
        if (options.json) {
            console.log(jsonOk({ apps }));
        } else {
            printApps(apps);
        }
        return;
    }

    // Resolve app name
    if (!app) {
        if (interactive) {
            const apps = await getRunningApps();
            const choices = ['⌕ Full Screen', ...apps];
            const chosen = await promptChoice('Screenshot target', choices, (name) => name);
            if (chosen === '⌕ Full Screen') {
                const dest = await captureFullScreen(options.output);
                const result = { screenshots: [{ path: dest, type: 'fullscreen' }] };
                if (options.ocr) {
                    result.screenshots[0].ocr = await ocrFile(dest);
                    if (!options.json) console.log(result.screenshots[0].ocr);
                } else if (!options.json) {
                    console.log(dest);
                }
                if (options.json) console.log(jsonOk(result));
                return;
            }
            app = chosen;
        } else {
            console.error('Missing required argument: <app>. Use --apps to list available application names.');
            process.exit(2);
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
                process.exit(3);
            }
        } else {
            process.exit(3);
        }
    }

    if (options.list) {
        if (options.json) {
            console.log(jsonOk({ app, windows: windows.map(w => ({ id: w.id, title: w.title, width: w.width, height: w.height })) }));
        } else {
            info(`Windows for "${app}":`);
            for (const w of windows) {
                console.log(`  id=${w.id}  ${w.width}x${w.height}  "${w.title}"`);
            }
        }
        return;
    }

    const screenshots = [];

    if (interactive) {
        const win = windows.length === 1
            ? windows[0]
            : await promptChoice('Multiple windows found', windows, (w) => `${w.width}x${w.height}  "${w.title}"`);
        const dest = await captureWindow(app, win, options.output);
        const entry = { path: dest, window: { id: win.id, title: win.title, width: win.width, height: win.height } };
        if (options.ocr) {
            entry.ocr = await ocrFile(dest);
            if (!options.json) console.log(entry.ocr);
        } else if (!options.json) {
            console.log(dest);
        }
        screenshots.push(entry);
    } else {
        if (windows.length === 1 && options.output) {
            const win = windows[0];
            const dest = await captureWindow(app, win, options.output);
            const entry = { path: dest, window: { id: win.id, title: win.title, width: win.width, height: win.height } };
            if (options.ocr) {
                entry.ocr = await ocrFile(dest);
                if (!options.json) console.log(entry.ocr);
            } else if (!options.json) {
                console.log(dest);
            }
            screenshots.push(entry);
        } else {
            for (const win of windows) {
                const dest = await captureWindow(app, win, null);
                const entry = { path: dest, window: { id: win.id, title: win.title, width: win.width, height: win.height } };
                if (options.ocr) {
                    entry.ocr = await ocrFile(dest);
                    if (!options.json) console.log(entry.ocr);
                } else if (!options.json) {
                    console.log(dest);
                }
                screenshots.push(entry);
            }
        }
    }

    if (options.json) {
        console.log(jsonOk({ screenshots }));
    }
}

module.exports = { screenshot };
