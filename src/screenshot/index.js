const { promptChoice, printApps } = require('./ui/prompt');
const { listWindows, getRunningApps } = require('./windows/discovery');
const { filterByTitle } = require('./windows/filter');
const { captureWindow } = require('./capture/window');
const { captureFullScreen } = require('./capture/fullscreen');
const { extractText } = require('../tesseract');

async function ocrFile(filePath) {
    const text = await extractText(filePath);
    console.log(text);
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
                const dest = await captureFullScreen(options.output);
                if (options.ocr) await ocrFile(dest);
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
        const win = windows.length === 1
            ? windows[0]
            : await promptChoice('Multiple windows found', windows, (w) => `${w.width}x${w.height}  "${w.title}"`);
        const dest = await captureWindow(app, win, options.output);
        if (options.ocr) await ocrFile(dest);
    } else {
        if (windows.length === 1 && options.output) {
            const dest = await captureWindow(app, windows[0], options.output);
            if (options.ocr) await ocrFile(dest);
        } else {
            for (const win of windows) {
                const dest = await captureWindow(app, win, null);
                if (options.ocr) await ocrFile(dest);
            }
        }
    }
}

module.exports = { screenshot };
