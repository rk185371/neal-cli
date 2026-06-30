const { createInterface } = require('readline');

function promptChoice(label, items, formatItem) {
    return new Promise((resolve) => {
        process.stderr.write(`${label}:\n`);
        items.forEach((item, i) => {
            process.stderr.write(`  [${i + 1}] ${formatItem(item)}\n`);
        });
        const rl = createInterface({ input: process.stdin, output: process.stderr });
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

function printApps(apps) {
    for (const name of apps) {
        console.log(name);
    }
}

module.exports = { promptChoice, printApps };
