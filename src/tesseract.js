const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const extractText = async (filePath) => {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve('.', filePath);
    const worker = await createWorker('eng');
    const ret = await worker.recognize(fs.readFileSync(resolved));
    await worker.terminate();
    return ret.data.text;
};

const extractTextFromImage = async (filePath) => {
    console.log(`Starting conversion..${filePath}`);
    const text = await extractText(filePath);
    console.log(text);
};

module.exports = { extractTextFromImage, extractText };
