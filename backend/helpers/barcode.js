const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const FALLBACK_PORTS = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6'];

function parseBarcodeReading(rawValue) {
  const raw = String(rawValue || '');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/[\u0000-\u001f\u007f]/g, '').trim())
    .filter(Boolean);
  const barcode = lines[0] || raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return barcode
    ? { success: true, barcode, raw: rawValue }
    : { success: false, barcode: '', raw: rawValue, message: 'El lector no devolvio un codigo.' };
}

async function listSerialPorts() {
  try {
    const serialport = require('serialport');
    const ports = await serialport.SerialPort.list();
    const paths = ports.map((port) => port.path).filter(Boolean);
    return paths.length ? paths : FALLBACK_PORTS;
  } catch (error) {
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_SerialPort | Select-Object -ExpandProperty DeviceID"',
          { timeout: 5000 }
        );
        const ports = stdout
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean);
        return ports.length ? ports : FALLBACK_PORTS;
      } catch (commandError) {
        return FALLBACK_PORTS;
      }
    }

    return FALLBACK_PORTS;
  }
}

function escapePowerShell(value) {
  return String(value || '').replace(/'/g, "''");
}

async function probeSerialPort(port, baudRate) {
  if (!port) {
    return {
      success: false,
      port: '',
      baudRate: Number(baudRate || 9600),
      message: 'Debes seleccionar un puerto COM.'
    };
  }

  try {
    const serialport = require('serialport');
    const serial = new serialport.SerialPort({
      path: port,
      baudRate: Number(baudRate || 9600),
      autoOpen: false
    });

    await new Promise((resolve, reject) => {
      serial.open((error) => {
        if (error) {
          reject(error);
          return;
        }

        serial.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve();
        });
      });
    });

    return {
      success: true,
      port,
      baudRate: Number(baudRate || 9600),
      strategy: 'serialport',
      message: 'Puerto serial validado correctamente.'
    };
  } catch (error) {
    if (process.platform === 'win32') {
      try {
        const escapedPort = escapePowerShell(port);
        const parsedBaudRate = Number(baudRate || 9600);
        const command = [
          `$serial = New-Object System.IO.Ports.SerialPort '${escapedPort}', ${parsedBaudRate}, 'None', 8, 'one'`,
          '$serial.ReadTimeout = 500',
          '$serial.WriteTimeout = 500',
          '$serial.Open()',
          'Start-Sleep -Milliseconds 250',
          '$serial.Close()'
        ].join('; ');

        await execAsync(`powershell -NoProfile -Command "${command}"`, {
          timeout: 5000
        });

        return {
          success: true,
          port,
          baudRate: parsedBaudRate,
          strategy: 'powershell',
          message: 'Puerto serial validado correctamente.'
        };
      } catch (commandError) {
        return {
          success: false,
          port,
          baudRate: Number(baudRate || 9600),
          strategy: 'powershell',
          message: commandError.message || 'No fue posible abrir el puerto serial.'
        };
      }
    }

    return {
      success: false,
      port,
      baudRate: Number(baudRate || 9600),
      strategy: 'unavailable',
      message: error.message || 'No fue posible validar el puerto serial.'
    };
  }
}

async function testScannerConnection({ port, baudRate }) {
  const result = await probeSerialPort(port, baudRate);
  return {
    ...result,
    message: result.success
      ? 'Puerto del lector validado correctamente.'
      : result.message
  };
}

async function closeSerialPort(serial) {
  if (!serial || !serial.isOpen) return;
  await new Promise((resolve) => serial.close(() => resolve()));
}

async function readScannerBarcode({ enabled = true, port, baudRate = 9600, timeoutMs = 2200 } = {}) {
  if (!enabled) {
    return {
      success: false,
      enabled: false,
      barcode: '',
      message: 'Lector desactivado.'
    };
  }

  if (!port) {
    return {
      success: false,
      enabled: true,
      barcode: '',
      message: 'Debes seleccionar el puerto del lector.'
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
      barcode: '',
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

    const result = await new Promise((resolve, reject) => {
      let buffer = '';
      const finishWithBuffer = () => {
        const parsed = parseBarcodeReading(buffer);
        if (parsed.success) {
          resolve(parsed);
          return;
        }
        reject(new Error('El lector no envio un codigo dentro del tiempo esperado.'));
      };
      const timer = setTimeout(finishWithBuffer, timeoutMs);
      const onData = (chunk) => {
        buffer += chunk.toString('utf8');
        if (/[\r\n]/.test(buffer)) {
          clearTimeout(timer);
          const parsed = parseBarcodeReading(buffer);
          parsed.success ? resolve(parsed) : reject(new Error(parsed.message));
        }
      };
      serial.on('data', onData);
      serial.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    return {
      ...result,
      enabled: true,
      port,
      baudRate: Number(baudRate || 9600),
      message: `Codigo leido: ${result.barcode}.`
    };
  } catch (error) {
    return {
      success: false,
      enabled: true,
      port,
      baudRate: Number(baudRate || 9600),
      barcode: '',
      message: error.message || 'No fue posible leer el lector.'
    };
  } finally {
    await closeSerialPort(serial);
  }
}

async function autoDetectScanner({ baudRate = 9600 } = {}) {
  const ports = await listSerialPorts();
  if (!ports.length) {
    return {
      found: false,
      success: false,
      port: '',
      baudRate: Number(baudRate || 9600),
      message: 'No se encontraron puertos seriales para el lector.'
    };
  }

  for (const port of ports) {
    const result = await probeSerialPort(port, baudRate);
    if (result.success) {
      return {
        found: true,
        ...result,
        message: `Lector detectado automaticamente en ${port}.`
      };
    }
  }

  const suggestedPort = ports[0];
  return {
    found: Boolean(suggestedPort),
    success: Boolean(suggestedPort),
    port: suggestedPort || '',
    baudRate: Number(baudRate || 9600),
    strategy: 'guess',
    message: suggestedPort
      ? `No fue posible validar automaticamente el lector, pero se sugiere el puerto ${suggestedPort}.`
      : 'No se encontro un puerto sugerido para el lector.'
  };
}

module.exports = {
  autoDetectScanner,
  listSerialPorts,
  parseBarcodeReading,
  probeSerialPort,
  readScannerBarcode,
  testScannerConnection
};
