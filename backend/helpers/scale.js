const { listSerialPorts, probeSerialPort, autoDetectScanner } = require('./barcode');

const UNIT_FACTORS_TO_KG = {
  kg: 1,
  kgs: 1,
  kilo: 1,
  kilos: 1,
  g: 0.001,
  gr: 0.001,
  gram: 0.001,
  gramos: 0.001,
  lb: 0.45359237,
  lbs: 0.45359237,
  libra: 0.45359237,
  libras: 0.45359237,
  oz: 0.028349523125
};

function parseScaleNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;

  const normalized = raw.includes(',') && raw.includes('.')
    ? (raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, ''))
    : raw.replace(',', '.');
  return Number(normalized);
}

function parseWeightReading(rawValue, { defaultUnit = 'kg' } = {}) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return {
      success: false,
      raw,
      message: 'La bascula no devolvio una lectura.'
    };
  }

  const match = raw.match(/([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(kg|kgs|kilo|kilos|g|gr|gram|gramos|lb|lbs|libra|libras|oz)?/i);
  if (!match) {
    return {
      success: false,
      raw,
      message: `No se pudo interpretar la lectura de la bascula: ${raw}`
    };
  }

  const numericValue = parseScaleNumber(match[1]);
  const unit = String(match[2] || defaultUnit || 'kg').toLowerCase();
  const factor = UNIT_FACTORS_TO_KG[unit];
  if (!Number.isFinite(numericValue) || !factor) {
    return {
      success: false,
      raw,
      message: `La lectura de la bascula no es valida: ${raw}`
    };
  }

  const weightKg = numericValue * factor;
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    return {
      success: false,
      raw,
      message: 'La bascula devolvio un peso negativo o invalido.'
    };
  }

  return {
    success: true,
    raw,
    value: numericValue,
    unit,
    weightKg: Number(weightKg.toFixed(3)),
    message: `Peso leido: ${Number(weightKg.toFixed(3))} kg.`
  };
}

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

async function closeSerialPort(serial) {
  if (!serial || !serial.isOpen) return;
  await new Promise((resolve) => serial.close(() => resolve()));
}

async function readScaleWeight({ enabled = true, port, baudRate = 9600, timeoutMs = 1800, command = '\\r\\n' } = {}) {
  if (!enabled) {
    return {
      success: false,
      enabled: false,
      weightKg: null,
      message: 'Bascula desactivada.'
    };
  }

  if (!port) {
    return {
      success: false,
      enabled: true,
      weightKg: null,
      message: 'Debes seleccionar el puerto de la bascula.'
    };
  }

  let serialport;
  try {
    serialport = require('serialport');
  } catch (error) {
    return {
      success: false,
      enabled: true,
      port,
      weightKg: null,
      message: 'El soporte serial no esta disponible en esta instalacion.'
    };
  }

  const serial = new serialport.SerialPort({
    path: port,
    baudRate: Number(baudRate || 9600),
    autoOpen: false
  });

  try {
    await new Promise((resolve, reject) => {
      serial.open((error) => (error ? reject(error) : resolve()));
    });

    const reading = await new Promise((resolve, reject) => {
      let buffer = '';
      const timer = setTimeout(() => reject(new Error('La bascula no envio una lectura dentro del tiempo esperado.')), timeoutMs);
      const onData = (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines.concat(buffer ? [buffer] : [])) {
          const parsed = parseWeightReading(line);
          if (parsed.success) {
            clearTimeout(timer);
            resolve(parsed);
            return;
          }
        }
      };
      serial.on('data', onData);
      serial.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      serial.write(command, (error) => {
        if (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
    });

    return {
      ...reading,
      enabled: true,
      port,
      baudRate: Number(baudRate || 9600)
    };
  } catch (error) {
    return {
      success: false,
      enabled: true,
      port,
      baudRate: Number(baudRate || 9600),
      weightKg: null,
      message: error.message || 'No fue posible leer la bascula.'
    };
  } finally {
    await closeSerialPort(serial);
  }
}

module.exports = {
  autoDetectScale,
  listScalePorts,
  parseWeightReading,
  readScaleWeight,
  testScaleConnection
};
