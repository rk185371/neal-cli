#!/usr/bin/env node
const { program } = require('commander');
const {extractTextFromImage} = require("./src/tesseract");
const {screenshot} = require("./src/screenshot/index");
const {verify} = require("./src/verify/index");
const { jsonError } = require('./src/output');

program
    .name('neal')
    .description('`neal` is CLI tool for doing various things.')
    .version('0.0.1');

program
    .command('tess <filePath>', {})
    .description('Command to extract text from image given the image path')
    .action((filePath) => {
        extractTextFromImage(filePath)
    })

program
    .command('screenshot [app]')
    .alias('sc')
    .description('Capture a screenshot of a macOS window.\n\nExamples:\n  neal screenshot --apps\n  neal screenshot "Google Chrome"\n  neal screenshot Safari --title "GitHub" -o gh.png\n  neal screenshot Slack --list\n  neal sc iTerm2 --ocr')
    .option('-a, --apps', 'list running application names and exit')
    .option('-n, --no-interactive', 'disable interactive prompts (auto-pick largest window)')
    .option('-t, --title <substr>', 'only match windows whose title contains this substring (case-insensitive)')
    .option('-o, --output <path>', 'output PNG path (default: ./<app>-<timestamp>.png)')
    .option('-l, --list', 'list matching windows and exit without capturing')
    .option('--ocr', 'run OCR on the captured screenshot and print extracted text')
    .option('--json', 'output results as structured JSON')
    .action((app, options) => {
        screenshot(app, options).catch(err => {
            if (options.json) {
                console.log(jsonError('SCREENSHOT_FAILED', err.message, null));
            } else {
                console.error(err.message);
            }
            process.exit(1);
        });
    })

program
    .command('verify [app]')
    .description('Screenshot + OCR + assert expected text.\n\nExamples:\n  neal verify "Google Chrome" --expect "Dashboard"\n  neal verify Safari --title "GitHub" --expect "Pull requests"\n  neal verify --expect "Desktop"')
    .option('-t, --title <substr>', 'only match windows whose title contains this substring')
    .option('-o, --output <path>', 'output PNG path')
    .option('-e, --expect <text...>', 'text to look for in OCR output (repeatable, all must match)')
    .option('--json', 'output results as structured JSON')
    .action((app, options) => {
        if (!options.expect || options.expect.length === 0) {
            if (options.json) {
                console.log(jsonError('USAGE', '--expect is required', 'neal verify "AppName" --expect "some text"'));
                process.exit(2);
            }
            console.error('--expect is required. Usage: neal verify "AppName" --expect "some text"');
            process.exit(2);
        }
        verify(app, options).catch(err => {
            if (options.json) {
                console.log(jsonError('VERIFY_FAILED', err.message, null));
            } else {
                console.error(err.message);
            }
            process.exit(1);
        });
    })

program.parse(process.argv);
