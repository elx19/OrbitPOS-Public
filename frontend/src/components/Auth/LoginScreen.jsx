import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import { formatDate } from '../../lib/format';
import orbitposLogoUrl from '../../assets/orbitpos-logo.png';

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.13';

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
    <div className="app-surface flex min-h-screen items-center justify-center overflow-auto px-4 py-6">
      <Panel className="orbit-login-card screen-shell grid w-full max-w-6xl gap-0 overflow-hidden p-0 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="orbit-login-brand p-8 lg:p-12">
          <div className="orbit-login-wordmark">
            <img src={orbitposLogoUrl} alt="OrbitPOS" />
            <div>Orbit<span>POS</span></div>
          </div>
          <div className="mt-3 text-xs text-white/58">Tu negocio en movimiento · v{APP_VERSION}</div>
          <div className="mt-6 flex items-center gap-4">
            {displayLogoUrl ? (
              <img
                src={displayLogoUrl}
                alt={`Logo de ${businessName || 'Mi Negocio'}`}
                className="h-20 w-20 rounded-[24px] border border-white/15 bg-white/90 object-cover p-2"
                onError={() => businessLogoUrl && logoVisible && setLogoVisible(false)}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/15 bg-white/12 text-2xl font-bold">
                {initials}
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-white/60">Negocio activo</div>
              <div className="mt-2 text-2xl font-bold">{businessName || 'Mi Negocio'}</div>
            </div>
          </div>
          <h1 className="mt-8 text-4xl font-bold leading-tight">
            Tu negocio listo para <span className="text-emerald-300">vender</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/78">
            Administra tus ventas, inventario, caja y clientes desde una sola pantalla clara y rapida.
          </p>
          <div className="orbit-login-features">
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon">↗</span><span><b>Ventas rapidas</b><small>Atiende a tus clientes sin complicaciones.</small></span></div>
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon orbit-login-feature-icon-gold">□</span><span><b>Inventario inteligente</b><small>Controla tus productos en tiempo real.</small></span></div>
            <div className="orbit-login-feature"><span className="orbit-login-feature-icon">▥</span><span><b>Control de caja</b><small>Mantén tus cuentas siempre claras.</small></span></div>
          </div>
        </div>

        <div className="orbit-login-form p-8 lg:p-12">
          <div className="orbit-login-account-header">
            <div className="orbit-login-account-avatar">{initials}</div>
            <div><b>{businessName || 'Mi Negocio'}</b><small>Administrador</small></div>
          </div>
          {!showRecovery ? (
            <form onSubmit={handleSubmit}>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Acceso al sistema
              </div>
              <h2 className="mt-6 text-3xl font-bold text-ink">Bienvenido de nuevo</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Inicia sesion para continuar.
              </p>

              <div className="mt-8 space-y-5">
                <Field label="Usuario">
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="Administrador"
                  />
                </Field>

                <Field label="Contrasena">
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="••••••••••"
                  />
                </Field>
              </div>

              {error ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="mt-8 w-full" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar a OrbitPOS  →'}
              </Button>

              <button
                type="button"
                className="mt-4 text-sm font-semibold text-slate-600 transition hover:text-ink"
                onClick={() => {
                  resetRecovery(form.username || 'admin');
                  setShowRecovery(true);
                }}
              >
                Recuperar contrasena con pregunta de seguridad
              </button>
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
