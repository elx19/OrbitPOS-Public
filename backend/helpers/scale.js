const { listSerialPorts, probeSerialPort, autoDetectScanner } = require('./barcode');

async function listScalePorts() {
  return listSerialPorts();
}

async function testScaleConnection({ enabled, port, baudRate }) {
  if (!enabled) {
    return {
      success: true,
      enabled: false,
      message: 'Bascula desactivada.'
    };
  }

  const result = await probeSerialPort(port, baudRate);
  return {
    ...result,
    enabled: true,
    message: result.success
      ? 'Puerto de la bascula validado correctamente.'
      : result.message
  };
}

async function autoDetectScale({ baudRate = 9600 } = {}) {
  const result = await autoDetectScanner({ baudRate });
  return {
    ...result,
    enabled: result.found,
    message: result.found
      ? `Bascula sugerida en ${result.port}.`
      : result.message || 'No fue posible sugerir un puerto para la bascula.'
  };
}

module.exports = {
  autoDetectScale,
  listScalePorts,
  testScaleConnection
};
