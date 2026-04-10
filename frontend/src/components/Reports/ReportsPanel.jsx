import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';

function buildQuery(filters) {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }
  return params.toString();
}

function buildCsv(report) {
  const lines = [
    ['Periodo', report.range.label],
    [],
    ['Metrica', 'Valor'],
    ['Ventas', report.metrics.totalSales],
    ['Ventas brutas', report.metrics.grossSales],
    ['Descuentos', report.metrics.discounts],
    ['ITBIS', report.metrics.taxes],
    ['Ventas contado', report.metrics.cashSales],
    ['Ventas credito', report.metrics.creditSales],
    ['Compras', report.metrics.purchasesTotal],
    ['Devoluciones', report.metrics.returnsTotal],
    ['Abonos', report.metrics.paymentsTotal],
    ['Credito pendiente', report.metrics.pendingCredits],
    [],
    ['Top producto', 'Cantidad', 'Ingresos'],
    ...report.topProducts.map((item) => [item.product_name, item.quantity, item.revenue]),
    [],
    ['Factura', 'Cliente', 'Usuario', 'Tipo', 'Estado', 'Total', 'Fecha'],
    ...report.recentSales.map((item) => [
      item.invoice_number,
      item.customer_name || 'Consumidor final',
      item.username || '',
      item.type,
      item.status,
      item.total,
      item.created_at
    ])
  ];

  return lines.map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
}

export default function ReportsPanel({ token }) {
  const [filters, setFilters] = useState({
    range: '7d',
    dateFrom: '',
    dateTo: ''
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  async function loadReport(nextFilters = filters, { forceFresh = false } = {}) {
    setLoading(true);
    setMessage('');

    try {
      const query = buildQuery(nextFilters);
      const result = await apiRequest(`/api/reports?${query}`, {
        token,
        cacheMs: forceFresh ? 0 : 15000,
        cacheKey: `reports-summary:${query}`,
        forceFresh
      });
      setReport(result);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(filters);
  }, [token, filters.range, filters.dateFrom, filters.dateTo]);

  const metricCards = useMemo(() => {
    if (!report) {
      return [];
    }

    return [
      ['Ventas', formatCurrency(report.metrics.grossSales)],
      ['Descuentos', formatCurrency(report.metrics.discounts)],
      ['Compras', formatCurrency(report.metrics.purchasesTotal)],
      ['Devoluciones', formatCurrency(report.metrics.returnsTotal)],
      ['Abonos', formatCurrency(report.metrics.paymentsTotal)],
      ['Credito pendiente', formatCurrency(report.metrics.pendingCredits)]
    ];
  }, [report]);

  function exportCsv() {
    if (!report) {
      return;
    }

    const blob = new Blob([buildCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orbitpos-report-${report.range.dateFrom}-${report.range.dateTo}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    setExportingPdf(true);
    setMessage('');

    try {
      const response = await fetch(`${window.orbit?.backendUrl || 'http://localhost:3030'}/api/reports/pdf?${buildQuery(filters)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMessage = 'No fue posible exportar el PDF.';
        try {
          const payload = await response.json();
          errorMessage = payload.message || errorMessage;
        } catch (error) {
          // Ignore non-JSON error payloads.
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orbitpos-report-${report?.range?.dateFrom || filters.dateFrom || 'desde'}-${report?.range?.dateTo || filters.dateTo || 'hasta'}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Analitica y reportes</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Centro de reportes</h2>
            <div className="mt-3 text-sm text-slate-600">
              Consulta ventas, compras, devoluciones, abonos y desempeno comercial con una lectura mas clara.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => loadReport(filters, { forceFresh: true })}>
              Actualizar
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!report || exportingPdf}>
              {exportingPdf ? 'Exportando PDF...' : 'Exportar PDF'}
            </Button>
            <Button onClick={exportCsv} disabled={!report}>
              Exportar CSV
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr),260px]">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Periodo">
              <Select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}>
                <option value="today">Hoy</option>
                <option value="7d">Ultimos 7 dias</option>
                <option value="30d">Ultimos 30 dias</option>
                <option value="custom">Personalizado</option>
              </Select>
            </Field>
            <Field label="Desde">
              <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
            </Field>
          </div>
          <div className="rounded-[24px] bg-white/80 p-4 text-sm text-slate-600">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Rango activo</div>
            <div className="mt-2 font-semibold text-ink">
              {report?.range?.label || (filters.dateFrom || filters.dateTo ? `${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}` : 'Define un periodo')}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {loading ? 'Actualizando indicadores...' : 'Indicadores listos para exportar'}
            </div>
          </div>
        </div>
      </Panel>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      ) : null}

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Indicadores clave</div>
            <div className="mt-2 text-2xl font-bold text-ink">Resumen del periodo</div>
          </div>
          <div className="text-sm text-slate-500">{loading ? 'Cargando...' : `${metricCards.length} metricas`}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metricCards.map(([label, value]) => (
            <div key={label} className="rounded-[24px] bg-white/80 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
              <div className="mt-3 text-3xl font-bold text-ink">{loading ? '...' : value}</div>
            </div>
          ))}
        </div>
      </Panel>

      {report ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr),minmax(340px,0.96fr)]">
          <div className="space-y-6">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Top productos</div>
                  <h3 className="mt-2 text-2xl font-bold text-ink">Mas vendidos</h3>
                </div>
                <div className="text-sm text-slate-500">{report.topProducts.length} resultados</div>
              </div>

              <div className="soft-scrollbar mt-5 max-h-[320px] space-y-3 overflow-auto pr-1">
                {report.topProducts.length ? report.topProducts.map((item) => (
                  <div key={item.product_name} className="flex items-center justify-between rounded-[22px] bg-white/80 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-800">{item.product_name}</div>
                      <div className="mt-1 text-xs text-slate-500">Cantidad: {item.quantity}</div>
                    </div>
                    <div className="text-sm font-semibold text-ink">{formatCurrency(item.revenue)}</div>
                  </div>
                )) : (
                  <div className="rounded-[22px] bg-white/80 px-4 py-5 text-sm text-slate-500">
                    No hay productos destacados en este periodo.
                  </div>
                )}
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Ventas recientes</div>
                  <div className="mt-2 text-2xl font-bold text-ink">Ultimos movimientos</div>
                </div>
                <div className="text-sm text-slate-500">{report.recentSales.length} venta(s)</div>
              </div>
              <div className="soft-scrollbar mt-5 max-h-[420px] space-y-3 overflow-auto pr-1">
                {report.recentSales.length ? report.recentSales.map((item) => (
                  <div key={`${item.invoice_number}-${item.created_at}`} className="rounded-[22px] bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800">Factura #{item.invoice_number}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.customer_name || 'Consumidor final'} | {item.username || 'Sistema'}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-ink">{formatCurrency(item.total)}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] bg-white/80 px-4 py-5 text-sm text-slate-500">
                    No hay ventas recientes en el rango seleccionado.
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel className="overflow-hidden">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Ventas por usuario</div>
              <div className="mt-2 text-2xl font-bold text-ink">Rendimiento del equipo</div>
              <div className="soft-scrollbar mt-5 max-h-[260px] space-y-3 overflow-auto pr-1">
                {report.salesByUser.length ? report.salesByUser.map((item) => (
                  <div key={item.username} className="flex items-center justify-between rounded-[22px] bg-white/80 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-800">{item.username}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.total_sales} venta(s)</div>
                    </div>
                    <div className="text-sm font-semibold text-ink">{formatCurrency(item.total_amount)}</div>
                  </div>
                )) : (
                  <div className="rounded-[22px] bg-white/80 px-4 py-5 text-sm text-slate-500">
                    No hay ventas agrupadas por usuario en este periodo.
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Cotizaciones</div>
              <div className="mt-2 text-2xl font-bold text-ink">Actividad comercial</div>
              <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <div className="rounded-[22px] bg-white/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Emitidas</div>
                  <div className="mt-2 text-2xl font-bold text-ink">{report.quotes.totalQuotes}</div>
                </div>
                <div className="rounded-[22px] bg-white/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Convertidas</div>
                  <div className="mt-2 text-2xl font-bold text-ink">{report.quotes.convertedQuotes}</div>
                </div>
                <div className="rounded-[22px] bg-white/80 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Monto</div>
                  <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(report.quotes.quotedTotal)}</div>
                </div>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Stock bajo</div>
              <div className="mt-2 text-2xl font-bold text-ink">Alertas de inventario</div>
              <div className="soft-scrollbar mt-5 max-h-[320px] space-y-3 overflow-auto pr-1">
                {report.lowStock.length ? report.lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[22px] bg-white/80 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.category || 'Sin categoria'}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold text-rosewood">{item.stock}</div>
                      <div className="mt-1 text-xs text-slate-500">Minimo: {item.min_stock}</div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] bg-white/80 px-4 py-5 text-sm text-slate-500">
                    No hay productos en nivel critico.
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
