import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import { formatDate } from '../../lib/format';

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
    <div className="app-surface flex min-h-screen items-center justify-center overflow-auto">
      <Panel className="screen-shell grid min-h-screen w-full gap-8 overflow-hidden p-3 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[26px] bg-gradient-to-br from-ink via-slate-900 to-lagoon p-8 text-white">
          <div className="inline-flex rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.28em] text-white/80">
            OrbitPOS v2.0.0
          </div>
          <div className="mt-6 flex items-center gap-4">
            {businessLogoUrl && logoVisible ? (
              <img
                src={businessLogoUrl}
                alt={`Logo de ${businessName || 'Mi Negocio'}`}
                className="h-20 w-20 rounded-[24px] border border-white/15 bg-white/90 object-cover p-2"
                onError={() => setLogoVisible(false)}
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
          <h1 className="mt-6 text-4xl font-bold leading-tight">
            Terminal de venta profesional para caja, inventario y cobros.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/78">
            Inicia sesion para entrar al sistema y administrar ventas, clientes,
            inventario, caja y configuracion general del negocio.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-white/60">Negocio</div>
              <div className="mt-2 text-lg font-semibold">{businessName || 'Mi Negocio'}</div>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-white/60">Licencia</div>
              <div className="mt-2 text-lg font-semibold">{licenseSummary.title}</div>
              <div className="mt-1 text-sm text-white/74">{licenseSummary.detail}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] bg-white/72 p-8">
          {!showRecovery ? (
            <form onSubmit={handleSubmit}>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Acceso al sistema
              </div>
              <h2 className="mt-3 text-3xl font-bold text-ink">Iniciar sesion</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                En el primer acceso puedes entrar con las credenciales predeterminadas y luego
                cambiarlas desde el wizard.
              </p>

              <div className="mt-8 space-y-5">
                <Field label="Usuario">
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="admin"
                  />
                </Field>

                <Field label="Contrasena">
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="admin"
                  />
                </Field>
              </div>

              {error ? (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="mt-8 w-full" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar a OrbitPOS'}
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
