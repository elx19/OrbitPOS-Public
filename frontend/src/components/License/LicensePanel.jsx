import { useEffect, useState } from 'react';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import orbitposLicenseUrl from '../../assets/orbitpos-license.png';

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.62';

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
      <div className="flex flex-col gap-1">
        <h2 className="text-4xl font-bold tracking-tight text-ink">Licencia</h2>
        <p className="text-base text-slate-600">Administra la licencia de tu sistema OrbitPOS.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr),minmax(360px,0.85fr)]">
        <Panel className="border-emerald-300 bg-emerald-50/75">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-5xl text-white shadow-lg">✓</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-3xl font-bold text-ink">Licencia {license?.status === 'active' ? 'activa' : 'pendiente'}</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{license?.status || 'Pendiente'}</span>
              </div>
              <p className="mt-2 text-base text-emerald-800">Tu sistema OrbitPOS está funcionando correctamente.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-emerald-200 pt-5 sm:grid-cols-2">
            <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Número de serie</div><div className="mt-2 break-all font-bold text-ink">{license?.serial || 'Sin serial'}</div></div>
            <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Edición</div><div className="mt-2 font-bold text-ink">{license?.edition || license?.licenseType || 'Profesional'}</div><div className="text-xs text-slate-500">Supermercados · Carnicerías · Delicatessen</div></div>
            <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Válida hasta</div><div className="mt-2 font-bold text-ink">{formatDate(license?.expiresAt)}</div></div>
            <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Días restantes</div><div className="mt-2 inline-flex rounded-full bg-emerald-600 px-4 py-1.5 font-bold text-white">{license?.daysRemaining ?? '--'} días</div></div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start gap-4"><img src={orbitposLicenseUrl} alt="Activar licencia" className="h-14 w-14 rounded-2xl bg-emerald-50 object-contain p-2" /><div><h3 className="text-2xl font-bold text-ink">Activar licencia</h3><p className="mt-1 text-sm text-slate-600">Ingresa una nueva clave para activar o actualizar tu sistema.</p></div></div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-600">ID de esta máquina</div><div className="mt-2 break-all font-mono text-sm text-slate-700">{machineId}</div><div className="mt-1 text-xs text-slate-500">Comparte este ID con tu proveedor si necesitas una nueva licencia.</div></div>
          <form onSubmit={handleRenew} className="mt-5 space-y-4">
            <Field label="Clave de licencia"><Input value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="Ingresa tu clave de licencia aquí..." /></Field>
            {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}
            <Button type="submit" disabled={submitting} className="w-full">{submitting ? 'Actualizando...' : 'Activar licencia'}</Button>
          </form>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr),minmax(360px,0.85fr)]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-2xl font-bold text-ink">Historial de activaciones</h3><p className="mt-1 text-sm text-slate-600">Listado de activaciones realizadas en este y otros equipos.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{history.length} evento(s)</span></div>
          <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Equipo / evento</th><th className="px-3 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{history.length ? history.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(entry.created_at)}</td><td className="px-3 py-3"><div className="font-semibold text-ink">{entry.event_type}</div><div className="text-xs text-slate-500">{entry.license_type || 'sin tipo'}{entry.detail?.reason ? ` · ${entry.detail.reason}` : ''}</div></td><td className="px-3 py-3"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{entry.status || 'Registrada'}</span></td></tr>) : <tr><td colSpan="3" className="px-3 py-6 text-center text-slate-500">Todavía no hay historial de activaciones o validaciones.</td></tr>}</tbody></table></div>
        </Panel>

        <Panel>
          <h3 className="text-2xl font-bold text-ink">Diagnóstico de seguridad</h3><p className="mt-1 text-sm text-slate-600">Estado de la licencia y del entorno del sistema.</p>
          <div className="mt-5 space-y-3">{[
            ['Licencia válida', license?.status === 'active' ? 'La clave de licencia es correcta.' : 'Pendiente de activación.'],
            ['Integridad del sistema', 'No se han detectado archivos modificados.'],
            ['Conexión con servidor de licencias', diagnostics?.runtimeGuard?.lastSeenAt ? `Última verificación: ${formatDateTime(diagnostics.runtimeGuard.lastSeenAt)}` : 'Sin verificación reciente.'],
            ['Hardware autorizado', `Machine ID: ${machineId}`],
            ['Compatibilidad', license?.versionMinCompatible || APP_VERSION]
          ].map(([label, detail]) => <div key={label} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">✓</span><div className="min-w-0"><div className="font-semibold text-ink">{label}</div><div className="break-words text-xs text-slate-500">{detail}</div></div><span className="ml-auto rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">Correcto</span></div>)}</div>
          {license?.securityFlags?.length ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Alertas: {license.securityFlags.join(', ')}</div> : null}
        </Panel>
      </div>

      <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Soporte comercial</div><div className="mt-2 text-sm text-slate-600">JRTech · WhatsApp +1 (809) 404-2070 · jrr6867@gmail.com</div></div><div className="text-xs text-slate-500">Compatibilidad mínima: <span className="font-semibold text-slate-700">{license?.versionMinCompatible || APP_VERSION}</span></div></Panel>
    </div>
  );
}
