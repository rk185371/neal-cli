const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { info } = require('./output');

const extractText = async (filePath) => {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve('.', filePath);
    const worker = await createWorker('eng');
    const ret = await worker.recognize(fs.readFileSync(resolved));
    await worker.terminate();
    return ret.data.text;
};

const extractTextFromImage = async (filePath) => {
    info(`[neal] Running OCR`);
    info(`[neal] File: ${path.resolve(filePath)}`);
    const text = await extractText(filePath);
    console.log(`--- OCR RESULT ---\n\n${text}\n\n--- OCR END ---`);
    info(`[neal] Cleaning up eng.traineddata...`);
    fs.unlinkSync(path.resolve('eng.traineddata'));
};

module.exports = { extractTextFromImage, extractText };
