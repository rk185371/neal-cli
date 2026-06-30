const { listWindows, getRunningApps } = require('../screenshot/windows/discovery');
const { filterByTitle } = require('../screenshot/windows/filter');
const { captureWindow } = require('../screenshot/capture/window');
const { captureFullScreen } = require('../screenshot/capture/fullscreen');
const { extractText } = require('../tesseract');

async function verify(app, options) {
    let dest;

    if (!app) {
        // No app specified — full screen capture
        dest = await captureFullScreen(options.output);
    } else {
        let windows = await listWindows(app);

        if (options.title) {
            windows = filterByTitle(windows, options.title);
        }

        if (windows.length === 0) {
            const extra = options.title ? ` with title containing "${options.title}"` : '';
            console.error(`No windows found for "${app}"${extra}.`);
            process.exit(1);
        }

        // Pick largest window in non-interactive mode
        const win = windows.reduce((best, w) =>
            (w.width * w.height > best.width * best.height) ? w : best
        );

        dest = await captureWindow(app, win, options.output);
    }

    const text = await extractText(dest);

    const expects = Array.isArray(options.expect) ? options.expect : [options.expect];
    const results = expects.map(term => ({
        term,
        found: text.toLowerCase().includes(term.toLowerCase()),
    }));

    const allPassed = results.every(r => r.found);

    for (const r of results) {
        const icon = r.found ? '✓' : '✗';
        console.log(`  ${icon} "${r.term}"`);
    }

    if (allPassed) {
        console.log('PASS');
    } else {
        console.log('FAIL');
        process.exit(1);
    }
}

module.exports = { verify };
