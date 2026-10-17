import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import { formatDate } from '../../lib/format';
import orbitposLogoUrl from '../../assets/orbitpos-logo.png';
import loginStorefrontUrl from '../../assets/login-storefront.png';

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.17';

function ReferenceIcon({ name, className = '' }) {
  const paths = {
    cart: <><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="10" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    chart: <><path d="M5 19V11M12 19V6M19 19V3" /></>,
    store: <><path d="M4 10h16M5 10l1.5-5h11L20 10M6 10v9h12v-9M10 19v-5h4v5" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21c.8-3.5 3.2-5 7-5s6.2 1.5 7 5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    eye: <><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2" /></>,
    arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />
  };

  return (
    <svg className={`orbit-reference-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.store}
    </svg>
  );
}

function describeLicense(license) {
  if (license?.isActive) {
    return {
      title: license.licenseType === 'permanent' ? 'Licencia permanente activa' : 'Licencia activa',
      detail: license.expiresAt ? `Vence el ${formatDate(license.expiresAt)}` : 'Sin fecha de expiracion'
    };
  }

  if (license?.isDemo) {
    return {
      title: 'Modo DEMO activo',
      detail: license.daysRemaining !== null
        ? `${license.daysRemaining} dia(s) restantes`
        : 'Demo activa con todas las funciones'
    };
  }

  if (license?.isExpired || license?.shouldBlock) {
    return {
      title: 'Licencia vencida',
      detail: 'Debes renovar para seguir usando OrbitPOS'
    };
  }

  return {
    title: 'Licencia pendiente',
    detail: 'Activa una clave o inicia la demo'
  };
}

export default function LoginScreen({ businessName, businessLogo, license, onLogin }) {
  const [form, setForm] = useState({
    username: 'admin',
    password: 'admin'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovery, setRecovery] = useState({
    username: 'admin',
    question: '',
    answer: '',
    password: '',
    confirmPassword: ''
  });
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const businessLogoUrl = resolveAssetUrl(businessLogo);
  const initials = getInitials(businessName || 'OrbitPOS');
  const displayLogoUrl = businessLogoUrl && logoVisible ? businessLogoUrl : orbitposLogoUrl;
  const licenseSummary = useMemo(() => describeLicense(license), [license]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: form
      });
      onLogin(result);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetRecovery(nextUsername = form.username || 'admin') {
    setRecovery({
      username: nextUsername,
      question: '',
      answer: '',
      password: '',
      confirmPassword: ''
    });
    setRecoveryMessage('');
  }

  async function loadRecoveryQuestion() {
    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      const username = String(recovery.username || '').trim();
      if (!username) {
        throw new Error('Indica el usuario para buscar su pregunta.');
      }

      const result = await apiRequest(`/api/auth/recovery/question?username=${encodeURIComponent(username)}`);
      setRecovery((current) => ({
        ...current,
        username: result.username || username,
        question: result.question || ''
      }));
      setRecoveryMessage('Pregunta de seguridad cargada. Ya puedes restablecer la contrasena.');
    } catch (loadError) {
      setRecovery((current) => ({
        ...current,
        question: '',
        answer: '',
        password: '',
        confirmPassword: ''
      }));
      setRecoveryMessage(loadError.message);
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      if (!recovery.question) {
        throw new Error('Primero debes cargar la pregunta de seguridad.');
      }
      if (!recovery.answer.trim()) {
        throw new Error('Debes responder la pregunta de seguridad.');
      }
      if (!recovery.password.trim()) {
        throw new Error('Debes indicar la nueva contrasena.');
      }
      if (recovery.password.trim().length < 4) {
        throw new Error('La nueva contrasena debe tener al menos 4 caracteres.');
      }
      if (recovery.password !== recovery.confirmPassword) {
        throw new Error('La confirmacion de contrasena no coincide.');
      }

      await apiRequest('/api/auth/recovery/reset', {
        method: 'POST',
        body: {
          username: recovery.username,
          answer: recovery.answer,
          password: recovery.password
        }
      });

      setForm((current) => ({
        ...current,
        username: recovery.username,
        password: ''
      }));
      setRecoveryMessage('Contrasena restablecida correctamente. Ya puedes iniciar sesion.');
      setRecovery((current) => ({
        ...current,
        answer: '',
        password: '',
        confirmPassword: ''
      }));
    } catch (resetError) {
      setRecoveryMessage(resetError.message);
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="app-surface orbit-login-stage flex min-h-screen items-center justify-center overflow-auto px-4 py-6">
      <Panel className="orbit-login-card screen-shell grid w-full max-w-6xl gap-0 overflow-hidden p-0 lg:grid-cols-[1.08fr,0.92fr]">
        <div className="orbit-login-brand">
          <div className="orbit-login-wordmark"><img src={orbitposLogoUrl} alt="OrbitPOS" /><div>Orbit<span>POS</span></div></div>
          <h1>Tu negocio listo<br />para <span>vender</span></h1>
          <div className="orbit-login-features">
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon"><ReferenceIcon name="cart" /></span><span><b>Ventas rápidas</b><small>Atiende a tus clientes sin complicaciones.</small></span></div>
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon orbit-login-feature-icon-gold"><ReferenceIcon name="box" /></span><span><b>Inventario inteligente</b><small>Controla tus productos en tiempo real.</small></span></div>
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon"><ReferenceIcon name="chart" /></span><span><b>Control de caja</b><small>Mantén tus cuentas siempre claras.</small></span></div>
          </div>
          <div className="orbit-login-store-scene" aria-hidden="true">
            <img className="orbit-login-storefront-image" src={loginStorefrontUrl} alt="Tienda de barrio con productos frescos" />
          </div>
          <div className="orbit-login-version">OrbitPOS · Tu negocio en movimiento · v{APP_VERSION}</div>
        </div>

        <div className="orbit-login-form">
          <div className="orbit-login-account-header">
            <div className="orbit-login-account-icon"><ReferenceIcon name="store" /></div>
            <div><b>{businessName || 'Tienda San José'}</b><small>Administrador</small></div>
          </div>
          {!showRecovery ? (
            <form onSubmit={handleSubmit}>
              <h2 className="orbit-login-title">Bienvenido de nuevo</h2>
              <p className="orbit-login-subtitle">Inicia sesión para continuar</p>

              <div className="orbit-login-fields">
                <Field label="Usuario">
                  <div className="orbit-login-input-wrap"><ReferenceIcon name="user" /><Input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Administrador" /></div>
                </Field>

                <Field label="Contrasena">
                  <div className="orbit-login-input-wrap"><ReferenceIcon name="lock" /><Input type={passwordVisible ? 'text' : 'password'} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="••••••••••" /><button type="button" className="orbit-login-eye" aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setPasswordVisible((current) => !current)}><ReferenceIcon name="eye" /></button></div>
                </Field>
              </div>

              {error ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="orbit-login-submit mt-8 w-full" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar a OrbitPOS  →'}
              </Button>

              <button
                type="button"
                className="orbit-login-recovery-link mt-4"
                onClick={() => {
                  resetRecovery(form.username || 'admin');
                  setShowRecovery(true);
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <div className="orbit-login-license"><span><ReferenceIcon name="check" /></span><b>{licenseSummary.title}</b><ReferenceIcon name="arrow" className="orbit-login-license-arrow" /></div>
            </form>
          ) : (
            <form onSubmit={handleRecoverySubmit}>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Recuperacion local
              </div>
              <h2 className="mt-3 text-3xl font-bold text-ink">Restablecer contrasena</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Busca la pregunta del usuario y define una nueva contrasena directamente
                en este equipo.
              </p>

              <div className="mt-8 space-y-5">
                <Field label="Usuario">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      value={recovery.username}
                      onChange={(event) => setRecovery((current) => ({
                        ...current,
                        username: event.target.value
                      }))}
                      placeholder="admin"
                    />
                    <Button
                      variant="secondary"
                      disabled={recoveryLoading}
                      onClick={loadRecoveryQuestion}
                    >
                      {recoveryLoading ? 'Buscando...' : 'Buscar pregunta'}
                    </Button>
                  </div>
                </Field>

                <Field label="Pregunta de seguridad">
                  <Input
                    value={recovery.question}
                    readOnly
                    placeholder="Primero carga la pregunta"
                  />
                </Field>

                <Field label="Respuesta">
                  <Input
                    type="password"
                    value={recovery.answer}
                    onChange={(event) => setRecovery((current) => ({
                      ...current,
                      answer: event.target.value
                    }))}
                    placeholder="Respuesta de seguridad"
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Nueva contrasena">
                    <Input
                      type="password"
                      value={recovery.password}
                      onChange={(event) => setRecovery((current) => ({
                        ...current,
                        password: event.target.value
                      }))}
                      placeholder="Nueva contrasena"
                    />
                  </Field>

                  <Field label="Confirmar contrasena">
                    <Input
                      type="password"
                      value={recovery.confirmPassword}
                      onChange={(event) => setRecovery((current) => ({
                        ...current,
                        confirmPassword: event.target.value
                      }))}
                      placeholder="Repite la contrasena"
                    />
                  </Field>
                </div>
              </div>

              {recoveryMessage ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {recoveryMessage}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="submit" disabled={recoveryLoading}>
                  {recoveryLoading ? 'Procesando...' : 'Restablecer contrasena'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowRecovery(false);
                    setRecoveryMessage('');
                    resetRecovery(form.username || 'admin');
                  }}
                >
                  Volver al login
                </Button>
              </div>
            </form>
          )}
        </div>
      </Panel>
    </div>
  );
}
