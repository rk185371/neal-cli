const { execFile } = require('child_process');
const { promisify } = require('util');
const { fullScreenOutputPath } = require('../paths');
const { validateScreenshot } = require('./validate');
const { info } = require('../../output');

const execFileAsync = promisify(execFile);

async function captureFullScreen(outputPath) {
    const dest = outputPath || fullScreenOutputPath();

    try {
        await execFileAsync('screencapture', ['-x', '-o', dest]);
    } catch (err) {
        throw new Error(`screencapture failed: ${err.stderr || err.message}`);
    }

    validateScreenshot(dest);
    info(`Captured: full screen`);
    return dest;
}

module.exports = { captureFullScreen };
