import { API_BASE_URL } from '../../lib/api';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { formatDate } from '../../lib/format';

const APP_VERSION = window.orbit?.version || '2.0.3';

export default function HelpPanel({ license, machineId, token, onReconfigure }) {
  async function openManual() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/help/manual`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('No fue posible abrir el manual.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      window.alert(error.message || 'No fue posible abrir el manual.');
    }
  }

  function openSupport() {
    window.open('https://wa.me/18094042070', '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Ayuda y soporte</div>
            <h2 className="mt-3 text-3xl font-bold text-ink">OrbitPOS v{APP_VERSION}</h2>
            <p className="mt-3 text-sm text-slate-600">
              Accede al manual, soporte JRTech y datos tecnicos de la instalacion desde un mismo centro de ayuda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={openManual}>
              Abrir manual PDF
            </Button>
            <Button variant="secondary" onClick={openSupport}>
              WhatsApp soporte
            </Button>
            <Button variant="ghost" onClick={onReconfigure}>
              Reconfigurar sistema
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(280px,0.8fr)]">
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Soporte JRTech</div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div>Email: jrr6867@gmail.com</div>
            <div>WhatsApp: +1 (809) 404-2070</div>
            <div>Manual: Disponible desde este modulo</div>
          </div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Licencia</div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div>Estado: {license?.status || 'Pendiente'}</div>
            <div>Expira: {formatDate(license?.expiresAt)}</div>
            <div className="break-all">Machine ID: {machineId}</div>
            <div>Token activo: {token ? 'Sesion iniciada' : 'Sin sesion'}</div>
          </div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Acciones rapidas</div>
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={openManual}>Manual PDF</Button>
            <Button variant="secondary" onClick={openSupport}>Soporte WhatsApp</Button>
            <Button variant="ghost" onClick={onReconfigure}>Reconfigurar</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
