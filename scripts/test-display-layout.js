const assert = require('assert');
const { fitBoundsToWorkArea } = require('../shared/display-layout');

assert.deepStrictEqual(
  fitBoundsToWorkArea(
    { x: 100, y: 60, width: 1400, height: 840 },
    { x: 0, y: 0, width: 1920, height: 1040 }
  ),
  { x: 100, y: 60, width: 1400, height: 840 }
);

assert.deepStrictEqual(
  fitBoundsToWorkArea(
    { x: 100, y: 60, width: 1480, height: 920 },
    { x: 0, y: 0, width: 800, height: 600 }
  ),
  { x: 0, y: 0, width: 800, height: 600 }
);

assert.deepStrictEqual(
  fitBoundsToWorkArea(
    { x: -1500, y: 300, width: 1100, height: 800 },
    { x: -1280, y: 0, width: 1280, height: 720 }
  ),
  { x: -1280, y: 0, width: 1100, height: 720 }
);

assert.deepStrictEqual(
  fitBoundsToWorkArea(
    { x: 5000, y: 5000, width: 600, height: 500 },
    { x: 1920, y: 0, width: 1280, height: 720 }
  ),
  { x: 2600, y: 220, width: 600, height: 500 }
);

console.log('Display layout QA: OK');
