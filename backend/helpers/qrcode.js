const QRCode = require('qrcode');

async function generateQrCode(value) {
  return QRCode.toDataURL(value, {
    margin: 1,
    width: 160
  });
}

module.exports = {
  generateQrCode
};
