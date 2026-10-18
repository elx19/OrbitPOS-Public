import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import { formatDateTime } from '../../lib/format';

export default function NotificationsPanel({ token, onActivity, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({ total: 0, unread: 0 });
  const [filter, setFilter] = useState('all');

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

  function categoryFor(item) {
    const type = String(item.type || '').toLowerCase();
    if (type.includes('stock') || type.includes('inventory')) return 'inventory';
    if (type.includes('cash') || type.includes('caja')) return 'cash';
    if (type.includes('license') || type.includes('licencia')) return 'license';
    return 'all';
  }

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'all') return true;
    return categoryFor(item) === filter;
  });
  const countFor = (value) => value === 'all'
    ? summary.total
    : value === 'unread'
      ? summary.unread
      : notifications.filter((item) => categoryFor(item) === value).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-ink">Notificaciones</h2>
          <p className="mt-2 text-sm text-slate-600">Mantente al día con lo más importante de tu negocio.</p>
        </div>
        <Button onClick={markAllRead}>✓ Marcar todas como leídas</Button>
      </div>

      <Panel className="overflow-hidden">
        <div className="soft-scrollbar flex gap-2 overflow-x-auto pb-1">
          {[['all', 'Todas'], ['unread', 'No leídas'], ['inventory', 'Inventario'], ['cash', 'Caja'], ['license', 'Licencia']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-semibold ${filter === value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-700'}`}>
              {label} <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs">{countFor(value)}</span>
            </button>
          ))}
        </div>
        <div className="soft-scrollbar mt-5 max-h-[calc(100vh-18rem)] space-y-3 overflow-auto pr-1">
          {filteredNotifications.length ? filteredNotifications.map((item) => (
            <div key={item.id} className={`flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center ${item.read ? 'border-slate-200/70 bg-white/78' : 'border-rose-200 bg-rose-50/35'}`}>
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ${item.read ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                {categoryFor(item) === 'inventory' ? '!' : categoryFor(item) === 'cash' ? '▣' : categoryFor(item) === 'license' ? '✓' : '•'}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{item.type || 'Sistema'}</div>
                  <div className="mt-2 text-lg font-semibold text-ink">{item.message}</div>
                  <div className="mt-2 text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                </div>
                {!item.read ? (
                  <Button variant="ghost" onClick={() => markRead(item.id)}>
                    Marcar leída
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
