import { useState } from 'react';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { Field, Input } from '../ui/Field';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function LicenseGate({ license, machineId, onActivated }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleActivate(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      await apiRequest('/api/license/activate', {
        method: 'POST',
        body: { licenseKey }
      });
      setMessage('Licencia activada correctamente.');
      onActivated();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-surface flex min-h-screen items-center justify-center overflow-auto">
      <Panel className="screen-shell min-h-screen w-full max-w-none p-8">
        <div className="rounded-[28px] bg-gradient-to-r from-rosewood to-ink p-8 text-white">
          <div className="inline-flex rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.26em] text-white/80">
            Activacion requerida
          </div>
          <h1 className="mt-4 text-4xl font-bold">Tu demo de 30 dias ha finalizado</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">
            Para continuar usando OrbitPOS, activa una licencia comercial vinculada a esta
            maquina. Si necesitas asistencia, JRTech puede ayudarte con la renovacion.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Machine ID</div>
            <div className="mt-3 break-all text-sm font-semibold text-slate-800">{machineId}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Estado actual</div>
            <div className="mt-3 text-sm text-slate-700">
              {license?.expiresAt ? `Vencio el ${formatDate(license.expiresAt)}` : 'Sin licencia activa'}
            </div>
          </div>
        </div>

        {license?.securityMessage ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {license.securityMessage}
          </div>
        ) : null}

        <form onSubmit={handleActivate} className="mt-8 space-y-5 rounded-[28px] bg-white/76 p-6">
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
            {submitting ? 'Activando...' : 'Ingresar clave de licencia'}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
