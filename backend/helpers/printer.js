const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { spawn } = require('child_process');
const { buildWizardTestTicket } = require('./receipt');
const { getConfigValue } = require('../database');

const execAsync = promisify(exec);
let thermalPrinterLib = null;

function normalizePrinterRecord(printer = {}) {
  return {
    name: String(printer.Name || printer.name || '').trim(),
    port: String(printer.PortName || printer.port || '').trim(),
    driverName: String(printer.DriverName || printer.driverName || '').trim(),
    isDefault: Boolean(
      printer.Default === true ||
      printer.default === true ||
      String(printer.Default || printer.default || '').toLowerCase() === 'true'
    )
  };
}

function isVirtualPrinter(printer = {}) {
  return /pdf|xps|onenote|fax|microsoft print/i.test(`${printer.name} ${printer.driverName}`);
}

function scorePrinterCandidate(printer = {}) {
  let score = 0;
  const port = String(printer.port || '').toUpperCase();

  if (printer.isDefault) {
    score += 80;
  }
  if (/USB|COM|LPT|DOT4/.test(port)) {
    score += 35;
  }
  if (/WSD|IP_|TCP|IP/.test(port)) {
    score += 18;
  }
  if (!isVirtualPrinter(printer)) {
    score += 15;
  }
  if (printer.name) {
    score += 5;
  }
  if (isVirtualPrinter(printer)) {
    score -= 120;
  }

  return score;
}

async function listPrintersDetailed() {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PortName,DriverName,Default | ConvertTo-Json -Compress"',
        { timeout: 5000 }
      );

      if (!stdout.trim()) {
        return [];
      }

      const parsed = JSON.parse(stdout);
      const printers = Array.isArray(parsed) ? parsed : [parsed];
      return printers
        .map(normalizePrinterRecord)
        .filter((printer) => printer.name);
    } catch (error) {
      return [];
    }
  }

  try {
    const { stdout } = await execAsync('lpstat -a', { timeout: 5000 });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean)
      .map((name) => ({
        name,
        port: '',
        driverName: '',
        isDefault: false
      }));
  } catch (error) {
    return [];
  }
}

async function listPrinters() {
  const detailedPrinters = await listPrintersDetailed();
  if (detailedPrinters.length) {
    return detailedPrinters.map((printer) => printer.name);
  }

  try {
    const { stdout } = await execAsync('lpstat -a', { timeout: 5000 });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

async function autoDetectPrinter() {
  const printers = await listPrintersDetailed();
  if (!printers.length) {
    return {
      found: false,
      name: '',
      port: '',
      message: 'No se detectaron impresoras disponibles.'
    };
  }

  const candidates = [...printers].sort((left, right) => (
    scorePrinterCandidate(right) - scorePrinterCandidate(left)
  ));
  const selected = candidates[0];

  return {
    found: true,
    name: selected.name,
    port: selected.port,
    driverName: selected.driverName,
    mode: 'system',
    message: selected.port
      ? `Impresora detectada: ${selected.name} (${selected.port}).`
      : `Impresora detectada: ${selected.name}.`
  };
}

async function testPrinter(printerName, businessName = 'OrbitPOS') {
  const preview = buildWizardTestTicket(businessName, printerName || 'Impresora termica');
  const printResult = await printText(preview, {
    printerName,
    force: true
  });

  return {
    ...printResult,
    preview
  };
}

function escapePowerShell(value) {
  return String(value || '').replace(/'/g, "''");
}

function executeProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `La impresion termino con codigo ${code}.`));
    });
  });
}

function loadThermalPrinterLibrary() {
  if (thermalPrinterLib !== null) {
    return thermalPrinterLib;
  }

  try {
    thermalPrinterLib = require('node-thermal-printer');
  } catch (error) {
    thermalPrinterLib = false;
  }

  return thermalPrinterLib;
}

function resolvePrinterConfiguration(options = {}) {
  const printerName = String(options.printerName || getConfigValue('printer_name', '') || '').trim();
  const printerPort = String(options.printerPort || getConfigValue('printer_port', '') || '').trim();
  const printerDriverMode = String(options.printerDriverMode || getConfigValue('printer_driver_mode', 'system') || 'system').trim().toLowerCase();
  const printerInterface = String(options.printerInterface || getConfigValue('printer_interface', '') || '').trim();
  const printerWidth = Number(options.printerWidth || getConfigValue('printer_width', '48') || 48);

  let resolvedInterface = printerInterface;
  if (!resolvedInterface && printerDriverMode === 'escpos') {
    if (printerPort && /^(tcp|udp|printer|usb|file):/i.test(printerPort)) {
      resolvedInterface = printerPort;
    } else if (printerName) {
      resolvedInterface = `printer:${printerName}`;
    } else if (printerPort) {
      resolvedInterface = printerPort;
    }
  }

  return {
    printerName,
    printerPort,
    printerDriverMode,
    printerInterface: resolvedInterface,
    printerWidth: Number.isFinite(printerWidth) && printerWidth > 0 ? printerWidth : 48
  };
}

async function sendTextToPrinter(content, printerName = '') {
  const tempFilePath = path.join(os.tmpdir(), `orbitpos-print-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(tempFilePath, String(content || '').replace(/\n/g, os.EOL), 'utf8');

  try {
    if (process.platform === 'win32') {
      const filePath = escapePowerShell(tempFilePath);
      const targetPrinter = escapePowerShell(printerName);
      const command = targetPrinter
        ? `$content = Get-Content -Raw -LiteralPath '${filePath}'; $content | Out-Printer -Name '${targetPrinter}'`
        : `$content = Get-Content -Raw -LiteralPath '${filePath}'; $content | Out-Printer`;
      await executeProcess('powershell', ['-NoProfile', '-Command', command]);
    } else {
      const args = printerName ? ['-d', printerName, tempFilePath] : [tempFilePath];
      await executeProcess('lp', args);
    }
  } finally {
    fs.rmSync(tempFilePath, { force: true });
  }
}

async function sendEscPosToPrinter(content, configuration) {
  const thermal = loadThermalPrinterLibrary();
  if (!thermal) {
    throw new Error('ESC/POS directo requiere node-thermal-printer instalado.');
  }

  if (!configuration.printerInterface) {
    throw new Error('Debes configurar la interfaz de la impresora ESC/POS.');
  }

  const { ThermalPrinter, PrinterTypes } = thermal;
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: configuration.printerInterface,
    lineCharacter: '-',
    width: configuration.printerWidth,
    removeSpecialCharacters: false
  });

  const isConnected = await printer.isPrinterConnected().catch(() => false);
  if (!isConnected) {
    throw new Error('La impresora ESC/POS no respondio en la interfaz configurada.');
  }

  String(content || '').split(/\r?\n/).forEach((line) => {
    printer.println(line);
  });
  printer.cut();
  await printer.execute();
}

async function printText(content, options = {}) {
  const force = Boolean(options.force);
  const autoPrintEnabled = getConfigValue('auto_print_receipts', '0') === '1';
  const allowFallback = options.allowFallback !== false;
  const configuration = resolvePrinterConfiguration(options);

  if (!content) {
    return {
      attempted: false,
      printed: false,
      printerName: configuration.printerName || null,
      mode: configuration.printerDriverMode,
      message: 'No hay contenido para imprimir.'
    };
  }

  if (!force && !autoPrintEnabled) {
    return {
      attempted: false,
      printed: false,
      printerName: configuration.printerName || null,
      mode: configuration.printerDriverMode,
      message: 'La impresion automatica esta desactivada.'
    };
  }

  if (configuration.printerDriverMode === 'escpos') {
    try {
      await sendEscPosToPrinter(content, configuration);
      return {
        attempted: true,
        printed: true,
        printerName: configuration.printerName || null,
        mode: 'escpos',
        message: configuration.printerInterface
          ? `Impresion ESC/POS enviada por ${configuration.printerInterface}.`
          : 'Impresion ESC/POS enviada correctamente.'
      };
    } catch (error) {
      if (!allowFallback) {
        return {
          attempted: true,
          printed: false,
          printerName: configuration.printerName || null,
          mode: 'escpos',
          message: error.message || 'No fue posible enviar la impresion ESC/POS.'
        };
      }

      try {
        await sendTextToPrinter(content, configuration.printerName);
        return {
          attempted: true,
          printed: true,
          printerName: configuration.printerName || null,
          mode: 'system-fallback',
          message: `ESC/POS fallo y se uso el spooler del sistema. ${configuration.printerName ? `Impresion enviada a ${configuration.printerName}.` : 'Impresion enviada a la impresora predeterminada.'}`
        };
      } catch (fallbackError) {
        return {
          attempted: true,
          printed: false,
          printerName: configuration.printerName || null,
          mode: 'escpos',
          message: `${error.message || 'Fallo ESC/POS.'} ${fallbackError.message || 'Tambien fallo el spooler del sistema.'}`.trim()
        };
      }
    }
  }

  try {
    await sendTextToPrinter(content, configuration.printerName);
    return {
      attempted: true,
      printed: true,
      printerName: configuration.printerName || null,
      mode: 'system',
      message: configuration.printerName
        ? `Impresion enviada a ${configuration.printerName}.`
        : 'Impresion enviada a la impresora predeterminada.'
    };
  } catch (error) {
    return {
      attempted: true,
      printed: false,
      printerName: configuration.printerName || null,
      mode: 'system',
      message: error.message || 'No fue posible enviar la impresion.'
    };
  }
}

module.exports = {
  autoDetectPrinter,
  listPrinters,
  listPrintersDetailed,
  testPrinter,
  printText
};
