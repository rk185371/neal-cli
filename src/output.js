/**
 * Structured output helpers.
 * JSON envelope is consistent across all commands.
 */

function jsonOk(data, warnings = []) {
    return JSON.stringify({ status: 'ok', data, warnings }, null, 2);
}

function jsonError(code, message, fix, transient = false) {
    return JSON.stringify({
        status: 'error',
        error: { code, message, fix, transient }
    }, null, 2);
}

/** Print to stderr — all status/progress/diagnostics go here. */
function info(msg) {
    process.stderr.write(msg + '\n');
}

module.exports = { jsonOk, jsonError, info };
