const crypto = require('crypto');
const os = require('os');
const { machineIdSync } = require('node-machine-id');

function getMachineId() {
  try {
    return machineIdSync({ original: true });
  } catch (error) {
    return crypto
      .createHash('sha256')
      .update(`${process.platform}:${process.arch}:${os.hostname()}`)
      .digest('hex')
      .slice(0, 24);
  }
}

module.exports = {
  getMachineId
};
