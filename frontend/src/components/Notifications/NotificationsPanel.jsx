import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { formatDateTime } from '../../lib/format';

export default function NotificationsPanel({ token, onActivity, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0 });

  async function loadNotifications() {
    const result = await apiRequest('/api/notifications', { token });
    setNotifications(result.items);
    setSummary(result.summary);
    onUnreadChange?.(Number(result.summary?.unread || 0));
  }

  useEffect(() => {
    loadNotifications();
  }, [token]);

  async function markRead(id) {
    await apiRequest(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      token
    });
    await loadNotifications();
    onActivity?.();
  }

  async function markAllRead() {
    await apiRequest('/api/notifications/mark-all-read', {
      method: 'POST',
      token
    });
    await loadNotifications();
    onActivity?.();
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Centro de alertas</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Notificaciones</h2>
            <div className="mt-2 text-sm text-slate-600">
              Revisa avisos del sistema, licencias, stock y eventos internos sin perder contexto visual.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-sm text-slate-600">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumen</div>
              <div className="mt-2 font-semibold text-ink">{summary.unread} sin leer de {summary.total}</div>
            </div>
            <Button variant="secondary" onClick={markAllRead}>
              Marcar todo como leido
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Bandeja</div>
          <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">{notifications.length} alerta(s)</div>
        </div>
        <div className="soft-scrollbar mt-5 max-h-[calc(100vh-18rem)] grid gap-4 overflow-auto pr-1 xl:grid-cols-2">
          {notifications.length ? notifications.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-slate-200/70 bg-white/78 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.type}</div>
                  <div className="mt-2 text-lg font-semibold text-ink">{item.message}</div>
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                </div>
                {!item.read ? (
                  <Button variant="ghost" onClick={() => markRead(item.id)}>
                    Leida
                  </Button>
                ) : (
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    Leida
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
              No hay notificaciones registradas.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
