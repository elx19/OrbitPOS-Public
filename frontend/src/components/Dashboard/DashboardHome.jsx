import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import Panel from '../ui/Panel';
import Button from '../ui/Button';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';

function SummaryCard({ label, value, accent, icon, helper }) {
  return (
    <div className="orbit-kpi border border-slate-200/80 bg-white/80">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold ${accent}`}>{icon}</div>
      <div className="mt-4 text-sm font-medium text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

export default function DashboardHome({ token, refreshKey = 0, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setError('');

    apiRequest('/api/dashboard/summary', {
      token,
      cacheMs: refreshKey > 0 ? 0 : 12000,
      cacheKey: 'dashboard-summary',
      forceFresh: refreshKey > 0
    })
      .then((data) => {
        if (isMounted) {
          setSummary(data);
        }
      })
      .catch((dashboardError) => {
        if (isMounted) {
          setError(dashboardError.message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, refreshKey]);

  if (error) {
    return (
      <Panel>
        <div className="text-sm text-red-700">{error}</div>
      </Panel>
    );
  }

  if (!summary) {
    return (
      <Panel>
        <div className="text-sm text-slate-600">Cargando panel principal...</div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-4xl font-bold text-ink">Resumen del negocio</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Consulta el rendimiento de tu negocio y actúa rápidamente sobre lo importante.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <div className="text-xs text-slate-500">Periodo</div>
            <div className="mt-1 font-semibold text-ink">Hoy, {formatDate(new Date())}</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <SummaryCard label="Ventas de hoy" value={formatCurrency(summary.salesToday)} accent="bg-emerald-100 text-emerald-700" icon="↗" helper={`${summary.transactionsToday || 0} transacciones`} />
        <SummaryCard label="Transacciones" value={summary.transactionsToday || 0} accent="bg-blue-100 text-blue-700" icon="🛒" helper="Ventas registradas hoy" />
        <SummaryCard label="Inventario bajo" value={summary.lowStockCount} accent="bg-rose-100 text-rosewood" icon="!" helper="Productos necesitan reposición" />
        <SummaryCard label="Cuentas por cobrar" value={formatCurrency(summary.receivables)} accent="bg-amber-100 text-amber-700" icon="$" helper="Saldo pendiente de clientes" />
      </div>

      <Panel className="border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Punto de venta</div>
            <h2 className="mt-2 text-2xl font-bold text-ink">Nueva venta</h2>
            <p className="mt-2 text-sm text-slate-600">Escanea un producto, busca en el catálogo y cobra en pocos pasos.</p>
          </div>
          <Button onClick={() => onNavigate?.('pos')}>Ir a Ventas →</Button>
        </div>
      </Panel>

      <Panel className="p-0 overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-ink">Ventas de la semana</h2>
              <div className="mt-1 text-sm text-slate-500">Rendimiento de los últimos 7 días</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Últimos 7 días⌄</div>
          </div>
        </div>
        <div className="h-80 px-3 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.chart}>
              <defs>
                <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#13a56e" stopOpacity={0.42} />
                  <stop offset="95%" stopColor="#13a56e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
              <XAxis dataKey="label" stroke="#55617a" />
              <YAxis stroke="#55617a" />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="total" stroke="#13a56e" fill="url(#salesGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="overflow-hidden">
          <h3 className="text-xl font-bold text-ink">Productos más vendidos</h3>
          <div className="mt-1 text-sm text-slate-500">Productos con mayor rotación</div>
          <div className="soft-scrollbar mt-5 max-h-[340px] space-y-3 overflow-auto pr-1">
            {summary.topProducts.length ? summary.topProducts.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                <span className="text-sm font-semibold text-ink">{item.quantity}</span>
              </div>
            )) : <div className="text-sm text-slate-500">Todavia no hay ventas registradas.</div>}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <h3 className="text-xl font-bold text-ink">Últimas ventas</h3>
          <div className="soft-scrollbar mt-5 max-h-[340px] space-y-3 overflow-auto pr-1">
            {summary.recentSales.length ? summary.recentSales.map((item) => (
              <div key={`${item.invoice_number}-${item.created_at}`} className="rounded-2xl bg-white/80 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-800">{item.invoice_number || 'Sin numero'}</span>
                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(item.total)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
              </div>
            )) : <div className="text-sm text-slate-500">Todavia no hay ventas recientes.</div>}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <h3 className="text-xl font-bold text-ink">Cuentas por cobrar</h3>
          <div className="soft-scrollbar mt-5 max-h-[340px] space-y-3 overflow-auto pr-1">
            {summary.overdueCustomers.length ? summary.overdueCustomers.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                <span className="text-sm font-semibold text-rosewood">{formatCurrency(item.balance)}</span>
              </div>
            )) : <div className="text-sm text-slate-500">No hay clientes con deuda pendiente.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
