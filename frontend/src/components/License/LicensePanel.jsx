import { useEffect, useState } from 'react';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';

const APP_VERSION = window.orbit?.version || '2.0.1';

export default function LicensePanel({ token, license, machineId, onActivated }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);

  useEffect(() => {
    if (!token) {
      setHistory([]);
      setDiagnostics(null);
      return;
    }

    let ignore = false;

    Promise.all([
      apiRequest('/api/license/history', { token }),
      apiRequest('/api/license/diagnostics', { token })
    ])
      .then(([historyResult, diagnosticsResult]) => {
        if (ignore) {
          return;
        }
        setHistory(historyResult.items || []);
        setDiagnostics(diagnosticsResult);
      })
      .catch(() => {
        if (!ignore) {
          setHistory([]);
          setDiagnostics(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token, license?.status, license?.serial, license?.securityMessage]);

  async function handleRenew(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      await apiRequest('/api/license/activate', {
        method: 'POST',
        body: {
          licenseKey
        }
      });
      setLicenseKey('');
      setMessage('Licencia actualizada correctamente.');
      onActivated?.();
      if (token) {
        const [historyResult, diagnosticsResult] = await Promise.all([
          apiRequest('/api/license/history', { token }),
          apiRequest('/api/license/diagnostics', { token })
        ]);
        setHistory(historyResult.items || []);
        setDiagnostics(diagnosticsResult);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Licenciamiento</div>
            <h2 className="mt-3 text-3xl font-bold text-ink">Estado de la licencia</h2>
            <p className="mt-3 text-sm text-slate-600">
              Consulta el estado actual, identifica esta instalacion por su machine ID y reemplaza la clave cuando sea necesario.
            </p>
          </div>
          <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumen rapido</div>
            <div className="mt-2 text-lg font-bold text-ink">{license?.status || 'Pendiente'}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
            <div className="mt-3 text-lg font-semibold text-slate-800">{license?.status || 'Pendiente'}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo</div>
            <div className="mt-3 text-lg font-semibold text-slate-800">{license?.licenseType || 'Sin definir'}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Expiracion</div>
            <div className="mt-3 text-lg font-semibold text-slate-800">{formatDate(license?.expiresAt)}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Dias restantes</div>
            <div className="mt-3 text-lg font-semibold text-slate-800">{license?.daysRemaining ?? '--'}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Edicion</div>
            <div className="mt-3 text-lg font-semibold text-slate-800">{license?.edition || 'standard'}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Serial</div>
            <div className="mt-3 text-sm font-semibold text-slate-800">{license?.serial || 'Sin serial'}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 md:col-span-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Machine ID</div>
            <div className="mt-3 break-all text-sm font-semibold text-slate-800">{machineId}</div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 md:col-span-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Compatibilidad minima</div>
            <div className="mt-3 text-sm font-semibold text-slate-800">{license?.versionMinCompatible || APP_VERSION}</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Historial local</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Eventos de licencia</h3>
            </div>
            <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">{history.length} evento(s)</div>
          </div>

          <div className="soft-scrollbar mt-5 max-h-[360px] space-y-3 overflow-auto pr-1">
            {history.length ? history.map((entry) => (
              <div key={entry.id} className="rounded-[22px] bg-white/80 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase text-ink">{entry.event_type}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {entry.license_type || 'sin tipo'} | {entry.status || 'sin estado'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">{formatDateTime(entry.created_at)}</div>
                </div>
                {entry.detail?.reason ? (
                  <div className="mt-2 text-sm text-amber-700">{entry.detail.reason}</div>
                ) : null}
              </div>
            )) : (
              <div className="rounded-[22px] bg-white/80 px-4 py-5 text-sm text-slate-500">
                Todavia no hay historial de activaciones o validaciones.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Integridad local</div>
          <h3 className="mt-2 text-2xl font-bold text-ink">Proteccion y diagnostico</h3>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="rounded-[22px] bg-white/78 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ultimo chequeo</div>
              <div className="mt-2 font-semibold text-ink">
                {diagnostics?.runtimeGuard?.lastSeenAt ? formatDateTime(diagnostics.runtimeGuard.lastSeenAt) : 'Sin datos'}
              </div>
            </div>
            <div className="rounded-[22px] bg-white/78 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Intentos irregulares</div>
              <div className="mt-2 space-y-1">
                <div>Reloj retrocedido: {diagnostics?.runtimeGuard?.rollbackHits ?? license?.diagnostics?.rollbackHits ?? 0}</div>
                <div>Machine ID distinto: {diagnostics?.runtimeGuard?.mismatchHits ?? license?.diagnostics?.mismatchHits ?? 0}</div>
                <div>Huella alterada: {diagnostics?.runtimeGuard?.tamperHits ?? license?.diagnostics?.tamperHits ?? 0}</div>
              </div>
            </div>
            {license?.securityFlags?.length ? (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
                <div className="text-xs uppercase tracking-[0.2em]">Alertas</div>
                <div className="mt-2">{license.securityFlags.join(', ')}</div>
              </div>
            ) : (
              <div className="rounded-[22px] bg-emerald-50 px-4 py-4 text-emerald-700">
                No se detectan alertas activas de integridad.
              </div>
            )}
            {license?.securityMessage ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700">
                {license.securityMessage}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),280px]">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Renovacion</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Ingresar nueva clave</h3>
            <form onSubmit={handleRenew} className="mt-5 space-y-4">
              <Field label="Clave de licencia">
                <Input
                  value={licenseKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  placeholder="ORB2.xxxxxxxxx"
                />
              </Field>

              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                <span>Email: jrr6867@gmail.com</span>
                <span>WhatsApp: +1 (809) 404-2070</span>
              </div>

              {message ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {message}
                </div>
              ) : null}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Actualizando...' : 'Renovar / reemplazar licencia'}
              </Button>
            </form>
          </div>

          <div className="rounded-[24px] bg-white/78 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Soporte comercial</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Contacta a JRTech para renovacion, reemplazo o cambio de periodo.</div>
              <div className="font-semibold text-slate-800">WhatsApp: +1 (809) 404-2070</div>
              <div className="font-semibold text-slate-800">Email: jrr6867@gmail.com</div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
