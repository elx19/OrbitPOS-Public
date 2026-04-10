import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input, Select, TextArea } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import securityQuestions from '../../../../shared/security-questions.json';

const APP_VERSION = window.orbit?.version || '2.0.3';

const currencies = [
  ['DOP', 'Peso dominicano (RD$)'],
  ['USD', 'Dolar estadounidense ($)'],
  ['EUR', 'Euro (EUR)']
];

function getSecurityQuestionOptions(currentQuestion = '') {
  const trimmedCurrent = String(currentQuestion || '').trim();
  return trimmedCurrent && !securityQuestions.includes(trimmedCurrent)
    ? [trimmedCurrent, ...securityQuestions]
    : securityQuestions;
}

export default function WizardScreen({
  initialData,
  machineId,
  printers,
  serialPorts,
  onCompleted
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    business: {
      name: initialData?.business?.name || '',
      rnc: initialData?.business?.rnc || '',
      phone: initialData?.business?.phone || '',
      address: initialData?.business?.address || '',
      logo: initialData?.business?.logo || '',
      currency: initialData?.business?.currency || 'DOP'
    },
    printer: {
      name: initialData?.printer?.name || '',
      port: initialData?.printer?.port || ''
    },
    scanner: {
      port: initialData?.scanner?.port || '',
      baudRate: initialData?.scanner?.baudRate || 9600
    },
    scale: {
      enabled: initialData?.scale?.enabled || false,
      port: initialData?.scale?.port || '',
      baudRate: initialData?.scale?.baudRate || 9600
    },
    admin: {
      name: initialData?.admin?.name || 'Administrador',
      username: 'admin',
      password: '',
      confirmPassword: '',
      securityQuestion: initialData?.admin?.securityQuestion || '',
      securityAnswer: ''
    },
    licenseKey: ''
  }));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const totalSteps = 6;
  const isReview = step === totalSteps;
  const progress = isReview ? 100 : Math.round(((step + 1) / totalSteps) * 100);

  const validationMessage = useMemo(() => {
    if (step === 1 && !form.business.name.trim()) {
      return 'Indica el nombre del negocio para continuar.';
    }
    if (step === 5) {
      if (!form.admin.password) {
        return 'Define la contrasena inicial del usuario admin.';
      }
      if (form.admin.password !== form.admin.confirmPassword) {
        return 'La confirmacion de contrasena no coincide.';
      }
      if (form.admin.password.length < 4) {
        return 'La contrasena debe tener al menos 4 caracteres.';
      }
      if (!form.admin.securityQuestion.trim()) {
        return 'Debes configurar una pregunta de seguridad para recuperar la contrasena.';
      }
      if (!form.admin.securityAnswer.trim()) {
        return 'Debes indicar la respuesta de seguridad del administrador.';
      }
    }
    return '';
  }, [form, step]);

  async function persistDraft() {
    await apiRequest('/api/wizard/save-step', {
      method: 'POST',
      body: {
        payload: form
      }
    });
  }

  async function handleNext() {
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await persistDraft();
      setStep((current) => current + 1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await apiRequest('/api/wizard/complete', {
        method: 'POST',
        body: form
      });
      onCompleted();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest(endpoint, body) {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body
      });
      setMessage(result.message || 'Prueba completada.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function pickLogoFile() {
    if (!window.orbit?.files?.pickLogo) {
      setMessage('El selector de archivos solo esta disponible en la app de escritorio.');
      return;
    }

    try {
      const selectedPath = await window.orbit.files.pickLogo();
      if (!selectedPath) {
        return;
      }

      setForm((current) => ({
        ...current,
        business: {
          ...current.business,
          logo: selectedPath
        }
      }));
    } catch (error) {
      setMessage('No fue posible seleccionar el logo.');
    }
  }

  async function detectPrinter() {
    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/wizard/detect-printer', {
        method: 'POST'
      });

      if (result?.found) {
        setForm((current) => ({
          ...current,
          printer: {
            ...current.printer,
            name: result.name || '',
            port: result.port || ''
          }
        }));
      }

      setMessage(result.message || 'Deteccion de impresora completada.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function detectScanner() {
    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/wizard/detect-scanner', {
        method: 'POST',
        body: {
          baudRate: form.scanner.baudRate
        }
      });

      if (result?.port) {
        setForm((current) => ({
          ...current,
          scanner: {
            ...current.scanner,
            port: result.port,
            baudRate: result.baudRate || current.scanner.baudRate
          }
        }));
      }

      setMessage(result.message || 'Deteccion de lector completada.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function detectScale() {
    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/wizard/detect-scale', {
        method: 'POST',
        body: {
          baudRate: form.scale.baudRate
        }
      });

      if (result?.port) {
        setForm((current) => ({
          ...current,
          scale: {
            ...current.scale,
            enabled: true,
            port: result.port,
            baudRate: result.baudRate || current.scale.baudRate
          }
        }));
      }

      setMessage(result.message || 'Deteccion de bascula completada.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="rounded-[28px] bg-gradient-to-br from-ink via-slate-900 to-lagoon p-8 text-white">
              <div className="inline-flex rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.26em] text-white/80">
                Paso 1 de 6
              </div>
              <h1 className="mt-5 text-4xl font-bold">Bienvenido a OrbitPOS</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80">
                Vamos a dejar listo el negocio, la impresora, el lector, la bascula,
                el administrador y la licencia en un asistente corto.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sistema</div>
                <div className="mt-3 text-lg font-bold text-ink">OrbitPOS {APP_VERSION}</div>
                <div className="mt-2 text-sm text-slate-600">Desarrollado por JRTech</div>
              </div>
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Acceso inicial</div>
                <div className="mt-3 text-sm text-slate-700">Usuario por defecto: admin / admin</div>
                <div className="mt-2 break-all text-xs text-slate-500">Machine ID: {machineId}</div>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre del negocio">
              <Input
                value={form.business.name}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  business: { ...current.business, name: event.target.value }
                }))}
                placeholder="Mi Negocio"
              />
            </Field>
            <Field label="RNC">
              <Input
                value={form.business.rnc}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  business: { ...current.business, rnc: event.target.value }
                }))}
                placeholder="000-000000-0"
              />
            </Field>
            <Field label="Telefono">
              <Input
                value={form.business.phone}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  business: { ...current.business, phone: event.target.value }
                }))}
                placeholder="809-000-0000"
              />
            </Field>
            <Field label="Moneda">
              <Select
                value={form.business.currency}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  business: { ...current.business, currency: event.target.value }
                }))}
              >
                {currencies.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Direccion">
                <TextArea
                  rows={4}
                  value={form.business.address}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    business: { ...current.business, address: event.target.value }
                  }))}
                  placeholder="Direccion del negocio"
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Logo (ruta opcional)">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={form.business.logo}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      business: { ...current.business, logo: event.target.value }
                    }))}
                    placeholder="C:\\logos\\negocio.png"
                  />
                  <Button variant="secondary" onClick={pickLogoFile}>
                    Buscar logo
                  </Button>
                </div>
              </Field>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <Field label="Impresora termica">
              <Select
                value={form.printer.name}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  printer: { ...current.printer, name: event.target.value }
                }))}
              >
                <option value="">Seleccionar impresora</option>
                {printers.map((printer) => (
                  <option key={printer} value={printer}>{printer}</option>
                ))}
              </Select>
            </Field>
            <Field label="Puerto o detalle adicional">
              <Input
                value={form.printer.port}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  printer: { ...current.printer, port: event.target.value }
                }))}
                placeholder="USB001"
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={detectPrinter}>
                Detectar impresora automaticamente
              </Button>
              <Button
                variant="secondary"
                onClick={() => runTest('/api/wizard/test-printer', {
                  printerName: form.printer.name,
                  businessName: form.business.name || 'OrbitPOS'
                })}
              >
                Probar impresion
              </Button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <Field label="Puerto COM del lector">
              <Select
                value={form.scanner.port}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  scanner: { ...current.scanner, port: event.target.value }
                }))}
              >
                <option value="">Seleccionar puerto</option>
                {serialPorts.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </Select>
            </Field>
            <Field label="Velocidad">
              <Input
                type="number"
                value={form.scanner.baudRate}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  scanner: { ...current.scanner, baudRate: Number(event.target.value) || 9600 }
                }))}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={detectScanner}>
                Detectar lector automaticamente
              </Button>
              <Button
                variant="secondary"
                onClick={() => runTest('/api/wizard/test-scanner', form.scanner)}
              >
                Probar lector
              </Button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.scale.enabled}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  scale: { ...current.scale, enabled: event.target.checked }
                }))}
              />
              Activar bascula digital
            </label>

            <Field label="Puerto COM">
              <Select
                value={form.scale.port}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  scale: { ...current.scale, port: event.target.value }
                }))}
              >
                <option value="">Seleccionar puerto</option>
                {serialPorts.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </Select>
            </Field>

            <Field label="Velocidad">
              <Input
                type="number"
                value={form.scale.baudRate}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  scale: { ...current.scale, baudRate: Number(event.target.value) || 9600 }
                }))}
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={detectScale}>
                Detectar bascula automaticamente
              </Button>
              <Button
                variant="secondary"
                onClick={() => runTest('/api/wizard/test-scale', form.scale)}
              >
                Probar bascula
              </Button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre del administrador">
              <Input
                value={form.admin.name}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  admin: { ...current.admin, name: event.target.value }
                }))}
              />
            </Field>
            <Field label="Usuario">
              <Input value={form.admin.username} disabled />
            </Field>
            <Field label="Contrasena inicial">
              <Input
                type="password"
                value={form.admin.password}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  admin: { ...current.admin, password: event.target.value }
                }))}
                placeholder="Nueva contrasena"
              />
            </Field>
            <Field label="Confirmar contrasena">
              <Input
                type="password"
                value={form.admin.confirmPassword}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  admin: { ...current.admin, confirmPassword: event.target.value }
                }))}
                placeholder="Repite la contrasena"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Pregunta de seguridad">
                <Select
                  value={form.admin.securityQuestion}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    admin: { ...current.admin, securityQuestion: event.target.value }
                  }))}
                >
                  <option value="">Seleccionar pregunta precargada</option>
                  {getSecurityQuestionOptions(form.admin.securityQuestion).map((question) => (
                    <option key={question} value={question}>{question}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Respuesta de seguridad">
                <Input
                  type="password"
                  value={form.admin.securityAnswer}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    admin: { ...current.admin, securityAnswer: event.target.value }
                  }))}
                  placeholder="Respuesta que solo tu conozcas"
                />
              </Field>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="rounded-[28px] bg-gradient-to-r from-lagoon to-ink p-7 text-white">
              <div className="text-xs uppercase tracking-[0.26em] text-white/75">Listo</div>
              <h2 className="mt-3 text-3xl font-bold">Resumen de configuracion</h2>
              <p className="mt-3 text-sm leading-7 text-white/80">
                Si tienes licencia, ingresala ahora. Si no, OrbitPOS iniciara automaticamente la
                demo gratuita de 30 dias con todas las funciones desbloqueadas.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel className="bg-white/78">
                <h3 className="text-xl font-bold text-ink">Tu negocio</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <div>{form.business.name || 'Mi Negocio'}</div>
                  <div>{form.business.phone || 'Sin telefono'}</div>
                  <div>{form.business.address || 'Sin direccion'}</div>
                </div>
              </Panel>
              <Panel className="bg-white/78">
                <h3 className="text-xl font-bold text-ink">Hardware</h3>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <div>Impresora: {form.printer.name || 'Pendiente'}</div>
                  <div>Lector: {form.scanner.port || 'Pendiente'}</div>
                  <div>Bascula: {form.scale.enabled ? form.scale.port || 'Activa' : 'Desactivada'}</div>
                </div>
              </Panel>
            </div>

            <Field label="Clave de licencia (opcional)">
              <Input
                value={form.licenseKey}
                onChange={(event) => setForm((current) => ({ ...current, licenseKey: event.target.value }))}
                placeholder="ORB2.xxxxxxxxx"
              />
            </Field>
          </div>
        );
    }
  }

  return (
    <div className="app-surface min-h-screen overflow-auto">
      <div className="screen-shell w-full space-y-6 p-3">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
            {isReview ? 'Configuracion completa' : `Paso ${step + 1} de 6`}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/65">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember to-lagoon transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Panel className="p-8">
          {renderStep()}

          {message ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <Button
              variant="ghost"
              disabled={step === 0 || saving}
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
            >
              Volver
            </Button>

            {isReview ? (
              <Button disabled={saving} onClick={handleFinish}>
                {saving ? 'Finalizando...' : 'Activar licencia o iniciar demo'}
              </Button>
            ) : (
              <Button disabled={saving} onClick={handleNext}>
                {saving ? 'Guardando...' : 'Guardar y continuar'}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
