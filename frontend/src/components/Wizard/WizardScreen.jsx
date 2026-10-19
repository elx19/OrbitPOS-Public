import { useMemo, useRef, useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input, Select, TextArea } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { classNames } from '../../lib/format';
import securityQuestions from '../../../../shared/security-questions.json';
import orbitposLogoUrl from '../../assets/orbitpos-logo.png';
import wizardStorefrontUrl from '../../assets/wizard-storefront.png';
import colmadoIconUrl from '../../assets/business-types/colmado.png';
import carniceriaIconUrl from '../../assets/business-types/carniceria.png';
import embutidosIconUrl from '../../assets/business-types/embutidos.png';
import mixtoIconUrl from '../../assets/business-types/mixto.png';
import { readImageFileAsDataUrl } from '../../lib/logoPicker';

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.62';

function WizardIcon({ type }) {
  const paths = {
    cart: <><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="10" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
    meat: <><path d="M5 13c0-4 3-7 7-7 3 0 5 2 5 5 0 4-3 7-7 7-3 0-5-2-5-5Z" /><path d="M17 8c2-2 3-2 4-1M15 12h.01" /></>,
    sausage: <><path d="M5 15c0-4 4-8 9-8 3 0 5 1 5 3 0 4-4 8-9 8-3 0-5-1-5-3Z" /><path d="M9 8 7 6M15 17l2 2M12 8l-1-2" /></>,
    shop: <><path d="M4 10h16M5 10l1.5-5h11L20 10M6 10v9h12v-9M10 19v-5h4v5" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.2-1.6 2.6M12 17h.01" /></>
  };

  return <svg className="orbit-reference-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[type] || paths.shop}</svg>;
}

const businessTypes = [
  { value: 'colmado', label: 'Colmado', icon: 'cart', image: colmadoIconUrl, tone: 'green' },
  { value: 'carniceria', label: 'Carnicería', icon: 'meat', image: carniceriaIconUrl, tone: 'red' },
  { value: 'embutidos', label: 'Embutidos / Deli', icon: 'sausage', image: embutidosIconUrl, tone: 'orange' },
  { value: 'mixto', label: 'Mixto', icon: 'shop', image: mixtoIconUrl, tone: 'navy' }
];

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
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    business: {
      name: initialData?.business?.name || '',
      rnc: initialData?.business?.rnc || '',
      phone: initialData?.business?.phone || '',
      address: initialData?.business?.address || '',
      logo: initialData?.business?.logo || '',
      currency: initialData?.business?.currency || 'DOP',
      businessType: initialData?.business?.businessType || 'colmado',
      sellsByWeight: initialData?.business?.sellsByWeight ?? true
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
  const logoInputRef = useRef(null);

  const totalSteps = 6;
  const isReview = step === totalSteps;
  const progress = isReview ? 100 : Math.round(((step + 1) / totalSteps) * 100);
  const referenceSteps = ['Bienvenida', 'Negocio', 'Impuestos', 'Inventario', 'Listo'];
  const referenceStep = isReview ? 4 : step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : 3;

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
    try {
      const selectedPath = window.orbit?.files?.pickLogo
        ? await window.orbit.files.pickLogo()
        : '';
      if (!selectedPath) {
        if (!window.orbit?.files?.pickLogo) {
          logoInputRef.current?.click();
        }
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
      setMessage(error.message || 'No fue posible seleccionar el logo.');
    }
  }

  async function handleLogoInput(event) {
    try {
      const dataUrl = await readImageFileAsDataUrl(event.target.files?.[0]);
      if (dataUrl) {
        setForm((current) => ({ ...current, business: { ...current.business, logo: dataUrl } }));
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      event.target.value = '';
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
            <div className="orbit-wizard-step-hero">
              <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Paso 1 de 6 · Bienvenida</div>
              <h1 className="mt-3 text-3xl font-bold text-ink">Configura tu negocio en minutos</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Dejaremos listo el negocio, los dispositivos, el administrador y la licencia en un asistente corto.
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
          <div className="orbit-business-form">
            <Field label="Nombre del negocio">
              <Input
                value={form.business.name}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  business: { ...current.business, name: event.target.value }
                }))}
                placeholder="Ej. Super Colmado La Esquina"
              />
            </Field>
            <div className="orbit-business-section">
              <div className="orbit-business-section-label">Tipo de negocio</div>
              <div className="orbit-business-types">
                {businessTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`orbit-business-type orbit-business-type-${type.tone} ${form.business.businessType === type.value ? 'is-selected' : ''}`}
                    onClick={() => setForm((current) => ({ ...current, business: { ...current.business, businessType: type.value } }))}
                  >
                    <img src={type.image} alt="" />
                    <strong>{type.label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="orbit-business-bottom-grid">
              <Field label="Moneda">
                <Select
                  value={form.business.currency}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    business: { ...current.business, currency: event.target.value }
                  }))}
                >
                  {currencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <label className="orbit-weight-toggle">
                <span>¿Vendes por peso?</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.business.sellsByWeight}
                  className={form.business.sellsByWeight ? 'is-on' : ''}
                  onClick={() => setForm((current) => ({ ...current, business: { ...current.business, sellsByWeight: !current.business.sellsByWeight } }))}
                ><i /></button>
              </label>
            </div>
            <details className="orbit-business-advanced">
              <summary>Agregar datos fiscales, contacto y logo (opcional)</summary>
              <div className="orbit-business-extra-grid">
                <Field label="RNC (opcional)"><Input value={form.business.rnc} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, rnc: event.target.value } }))} placeholder="000-000000-0" /></Field>
                <Field label="Teléfono"><Input value={form.business.phone} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, phone: event.target.value } }))} placeholder="809-000-0000" /></Field>
                <Field label="Dirección"><TextArea rows={2} value={form.business.address} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, address: event.target.value } }))} placeholder="Dirección del negocio" /></Field>
                <Field label="Logo del negocio"><div className="flex flex-col gap-3 sm:flex-row"><Input value={form.business.logo} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, logo: event.target.value } }))} placeholder="Selecciona una imagen PNG, JPG o WEBP" /><Button variant="secondary" onClick={pickLogoFile}>Seleccionar logo</Button><input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/x-icon" className="hidden" onChange={handleLogoInput} /></div><div className="mt-2 text-xs text-slate-500">El logo se mostrará en el login, el perfil del usuario, los tickets y la vista previa.</div></Field>
              </div>
            </details>
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
                placeholder="ORB3.xxxxxxxxx"
              />
            </Field>
          </div>
        );
    }
  }

  return (
    <div className="app-surface min-h-screen overflow-auto">
      <div className="orbit-wizard-layout">
        <aside className="orbit-wizard-promo">
          <div className="orbit-wizard-wordmark"><img src={orbitposLogoUrl} alt="OrbitPOS" /><span>Orbit<b>POS</b></span></div>
          <h1>Configura tu negocio en <strong>minutos</strong></h1>
          <div className="orbit-wizard-storefront" aria-hidden="true">
            <img src={wizardStorefrontUrl} alt="Tienda de comestibles con letrero abierto" />
          </div>
          <div className="orbit-wizard-promo-points">
            <span><img src={colmadoIconUrl} alt="" />Colmado</span><span><img src={carniceriaIconUrl} alt="" />Carnicería</span><span><img src={embutidosIconUrl} alt="" />Embutidos / Deli</span>
          </div>
        </aside>

        <main className="orbit-wizard-main">
          <div className="orbit-wizard-main-header">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Configuracion inicial</div>
            <div className="orbit-wizard-stepper" aria-label="Progreso de configuración">
              {referenceSteps.map((label, index) => {
                const completed = isReview || referenceStep > index;
                const active = !isReview && referenceStep === index;
                return (
                  <div key={label} className="orbit-wizard-step">
                    <span className={classNames('orbit-wizard-step-dot', completed ? 'is-complete' : '', active ? 'is-active' : '')}>
                      {completed ? '✓' : index + 1}
                    </span>
                    <span>{label}</span>
                    {index < referenceSteps.length - 1 ? <i className={completed ? 'is-complete' : ''} /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <Panel className="orbit-wizard-form p-0">
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
                  {saving ? 'Finalizando...' : 'Activar licencia o iniciar demo  →'}
                </Button>
              ) : (
                <Button disabled={saving} onClick={handleNext}>
                  {saving ? 'Guardando...' : 'Continuar  →'}
                </Button>
              )}
            </div>
          </Panel>
        </main>
      </div>
    </div>
  );
}
