#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { imageFileToDataUrl, parseImageDataUrl } = require('../shared/image-data-url');

const qaDirectory = path.join(__dirname, '..', '.qa');
const imagePath = path.join(qaDirectory, 'logo-picker-test.png');
fs.mkdirSync(qaDirectory, { recursive: true });

try {
  const pngBytes = Buffer.from('89504e470d0a1a0a', 'hex');
  fs.writeFileSync(imagePath, pngBytes);
  const dataUrl = imageFileToDataUrl(imagePath);
  assert.match(dataUrl, /^data:image\/png;base64,/);
  const parsed = parseImageDataUrl(dataUrl);
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.extension, '.png');
  assert.deepEqual(parsed.buffer, pngBytes);
  assert.throws(() => parseImageDataUrl('data:text/plain;base64,SGk='), /imagen compatible/i);
  assert.throws(() => imageFileToDataUrl(path.join(qaDirectory, 'missing-logo.png')), /No se encontro/i);
  console.log('Image asset QA: OK (selector, data URL y backup de logo)');
} finally {
  if (fs.existsSync(imagePath)) fs.rmSync(imagePath, { force: true });
}
