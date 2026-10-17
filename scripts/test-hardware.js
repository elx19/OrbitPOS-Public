const assert = require('assert');
const { parseWeightReading, testScaleConnection } = require('../backend/helpers/scale');
const { parseBarcodeReading, readScannerBarcode } = require('../backend/helpers/barcode');

const kilogramReading = parseWeightReading('ST,GS, 1.250 kg');
assert.equal(kilogramReading.success, true);
assert.equal(kilogramReading.weightKg, 1.25);

const gramReading = parseWeightReading('NET 850 g');
assert.equal(gramReading.success, true);
assert.equal(gramReading.weightKg, 0.85);

const poundReading = parseWeightReading('+2.00 lb');
assert.equal(poundReading.success, true);
assert.equal(poundReading.weightKg, 0.907);

const spanishDecimalReading = parseWeightReading('PESO: 1,500 kg');
assert.equal(spanishDecimalReading.success, true);
assert.equal(spanishDecimalReading.weightKg, 1.5);

const invalidReading = parseWeightReading('READY STABLE');
assert.equal(invalidReading.success, false);

const barcodeReading = parseBarcodeReading('\u0002QA-123456\u0003\r\n');
assert.equal(barcodeReading.success, true);
assert.equal(barcodeReading.barcode, 'QA-123456');

const emptyBarcode = parseBarcodeReading('\u0002\u0003');
assert.equal(emptyBarcode.success, false);

Promise.all([
  testScaleConnection({ enabled: false }),
  readScannerBarcode({ enabled: false })
]).then(([result, scannerResult]) => {
  assert.equal(result.success, true);
  assert.equal(result.enabled, false);
  assert.equal(scannerResult.success, false);
  assert.equal(scannerResult.enabled, false);
  console.log('Hardware QA: OK');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
