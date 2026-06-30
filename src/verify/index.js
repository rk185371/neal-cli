const { listWindows, getRunningApps } = require('../screenshot/windows/discovery');
const { filterByTitle } = require('../screenshot/windows/filter');
const { captureWindow } = require('../screenshot/capture/window');
const { captureFullScreen } = require('../screenshot/capture/fullscreen');
const { extractText } = require('../tesseract');
const { jsonOk, jsonError } = require('../output');

async function verifyWindow(dest, expects, options, label) {
    const text = await extractText(dest);
    const results = expects.map(term => ({
        term,
        found: text.toLowerCase().includes(term.toLowerCase()),
    }));
    const passed = results.every(r => r.found);

    if (!options.json) {
        console.log(dest);
        for (const r of results) {
            const icon = r.found ? '✓' : '✗';
            console.log(`  ${icon} "${r.term}"`);
        }
        console.log(label ? `${passed ? 'PASS' : 'FAIL'} -> ${label}` : (passed ? 'PASS' : 'FAIL'));
    }

    return { screenshot: dest, results, passed };
}

async function verify(app, options) {
    const expects = Array.isArray(options.expect) ? options.expect : [options.expect];

    if (!app && options.title) {
        // No app but --title given: search all running apps for matching windows
        const apps = await getRunningApps();
        let matched = [];
        for (const a of apps) {
            try {
                const wins = await listWindows(a);
                const filtered = filterByTitle(wins, options.title);
                for (const w of filtered) matched.push({ app: a, win: w });
            } catch (_) { /* skip apps with no capturable windows */ }
        }

        if (matched.length === 0) {
            const msg = `No windows found with title containing "${options.title}".`;
            if (options.json) {
                console.log(jsonError('NOT_FOUND', msg, `neal screenshot --apps`));
                process.exit(3);
            }
            console.error(msg);
            process.exit(3);
        }

        // Verify each matching window
        const windowResults = [];
        for (const m of matched) {
            const dest = await captureWindow(m.app, m.win, matched.length === 1 ? options.output : null);
            const result = await verifyWindow(dest, expects, options, `${m.app} -> ${m.win.title}`);
            windowResults.push({ ...result, app: m.app, window: m.win.title });
        }

        const allPassed = windowResults.every(r => r.passed);
        if (options.json) {
            console.log(jsonOk({ windows: windowResults, passed: allPassed }));
        }
        if (!allPassed) process.exit(1);
        return;
    }

    // Single-target path: app provided, or no app and no title (full screen)
    let dest;

    if (!app) {
        dest = await captureFullScreen(options.output);
    } else {
        let windows = await listWindows(app);

        if (options.title) {
            windows = filterByTitle(windows, options.title);
        }

        if (windows.length === 0) {
            const extra = options.title ? ` with title containing "${options.title}"` : '';
            const msg = `No windows found for "${app}"${extra}.`;
            if (options.json) {
                console.log(jsonError('NOT_FOUND', msg, `neal screenshot --apps`));
                process.exit(3);
            }
            console.error(msg);
            process.exit(3);
        }

        const win = windows.reduce((best, w) =>
            (w.width * w.height > best.width * best.height) ? w : best
        );

        dest = await captureWindow(app, win, options.output);
    }

    const result = await verifyWindow(dest, expects, options, null);
    if (options.json) {
        console.log(jsonOk({ screenshot: result.screenshot, results: result.results, passed: result.passed }));
    }
    if (!result.passed) process.exit(1);
}

module.exports = { verify };
