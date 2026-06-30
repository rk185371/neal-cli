const { execFile } = require('child_process');
const { promisify } = require('util');
const { defaultOutputPath } = require('../paths');
const { validateScreenshot } = require('./validate');
const { info } = require('../../output');

const execFileAsync = promisify(execFile);

async function captureWindow(app, win, outputPath) {
    const dest = outputPath || defaultOutputPath(app, win);

    try {
        await execFileAsync('screencapture', [`-l${win.id}`, '-x', '-o', dest]);
    } catch (err) {
        throw new Error(`screencapture failed: ${err.stderr || err.message}`);
    }

    validateScreenshot(dest);
    info(`Captured: "${win.title}" (${win.width}x${win.height})`);
    return dest;
}

module.exports = { captureWindow };
