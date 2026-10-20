const fs = require('fs');
const path = require('path');

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon'
};

const EXTENSION_BY_MIME = Object.entries(MIME_BY_EXTENSION).reduce((result, [extension, mime]) => {
  result[mime] = extension;
  return result;
}, {});

const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

function assertImageSize(size, maxBytes = DEFAULT_MAX_BYTES) {
  if (size > maxBytes) {
    throw new Error(`La imagen supera el limite de ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  }
}

function imageFileToDataUrl(filePath, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const absolutePath = path.resolve(String(filePath || ''));
  if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error('No se encontro el archivo de imagen seleccionado.');
  }

  const extension = path.extname(absolutePath).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    throw new Error('El logo debe ser PNG, JPG, WEBP, BMP o ICO.');
  }

  const size = fs.statSync(absolutePath).size;
  assertImageSize(size, maxBytes);
  return `data:${mimeType};base64,${fs.readFileSync(absolutePath).toString('base64')}`;
}

function parseImageDataUrl(value, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const rawValue = String(value || '').trim();
  const match = rawValue.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match || !EXTENSION_BY_MIME[match[1].toLowerCase()]) {
    throw new Error('El logo guardado no es una imagen compatible.');
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  assertImageSize(buffer.length, maxBytes);
  const mimeType = match[1].toLowerCase();
  return {
    buffer,
    mimeType,
    extension: EXTENSION_BY_MIME[mimeType]
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  imageFileToDataUrl,
  parseImageDataUrl
};
