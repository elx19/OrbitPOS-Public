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
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';

function SummaryCard({ label, value, accent }) {
  return (
    <div className="rounded-[24px] bg-white/76 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className={`mt-3 text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}

export default function DashboardHome({ token, refreshKey = 0 }) {
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
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen ejecutivo</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Vista general del negocio</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Revisa ventas, alertas y el comportamiento comercial del dia sin salir del panel principal.
            </p>
          </div>
          <div className="rounded-[22px] bg-white/76 px-4 py-4 text-sm text-slate-600">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Operacion</div>
            <div className="mt-2 font-semibold text-ink">Panel en tiempo real</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <SummaryCard label="Ventas hoy" value={formatCurrency(summary.salesToday)} accent="text-emerald-700" />
        <SummaryCard label="Creditos" value={formatCurrency(summary.creditsOpen)} accent="text-amber-700" />
        <SummaryCard label="Bajo stock" value={`${summary.lowStockCount} productos`} accent="text-rosewood" />
        <SummaryCard label="Por cobrar" value={formatCurrency(summary.receivables)} accent="text-lagoon" />
      </div>

      <Panel className="p-0 overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-ink">Ventas ultimos 7 dias</h2>
            <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Tendencia semanal
            </div>
          </div>
        </div>
        <div className="h-80 px-3 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.chart}>
              <defs>
                <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
              <XAxis dataKey="label" stroke="#55617a" />
              <YAxis stroke="#55617a" />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="total" stroke="#d97706" fill="url(#salesGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="overflow-hidden">
          <h3 className="text-xl font-bold text-ink">Top productos</h3>
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
          <h3 className="text-xl font-bold text-ink">Ultimas ventas</h3>
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
          <h3 className="text-xl font-bold text-ink">Clientes con deuda</h3>
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
