const assert = require('assert');
const { parseWeightReading, testScaleConnection } = require('../backend/helpers/scale');

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

testScaleConnection({ enabled: false }).then((result) => {
  assert.equal(result.success, true);
  assert.equal(result.enabled, false);
  console.log('Hardware QA: OK');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
