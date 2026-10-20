import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
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

function paymentLabel(method) {
  const labels = {
    cash: 'Efectivo',
    card: 'Tarjeta de crédito',
    debit: 'Tarjeta de débito',
    transfer: 'Transferencia',
    mobile: 'Pago móvil',
    other: 'Vale / Otros'
  };
  return labels[String(method || '').toLowerCase()] || String(method || 'Otros');
}

function categoryTone(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('carne')) return 'bg-rose-100 text-rose-700';
  if (value.includes('embut')) return 'bg-orange-100 text-orange-700';
  if (value.includes('beb')) return 'bg-blue-100 text-blue-700';
  if (value.includes('láct') || value.includes('lact')) return 'bg-sky-100 text-sky-700';
  return 'bg-amber-100 text-amber-700';
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

    const averageTicket = report.metrics.totalSales
      ? report.metrics.grossSales / report.metrics.totalSales
      : 0;
    const estimatedMargin = report.metrics.grossSales - report.metrics.purchasesTotal;

    return [
      { label: 'Ventas netas', value: formatCurrency(report.metrics.grossSales - report.metrics.discounts), tone: 'green', icon: '↗' },
      { label: 'Margen estimado', value: formatCurrency(estimatedMargin), tone: 'blue', icon: '%' },
      { label: 'Ticket promedio', value: formatCurrency(averageTicket), tone: 'violet', icon: '🛒' },
      { label: 'Productos vendidos', value: String(report.itemsSold || 0), tone: 'amber', icon: '▣' }
    ];
  }, [report]);

  const salesByDay = useMemo(() => {
    const points = report?.salesByDay || [];
    const max = Math.max(...points.map((item) => Number(item.total_amount || 0)), 1);
    return points.map((item) => ({
      ...item,
      amount: Number(item.total_amount || 0),
      height: Math.max((Number(item.total_amount || 0) / max) * 100, 6),
      label: new Intl.DateTimeFormat('es-DO', { weekday: 'short' }).format(new Date(`${item.day}T12:00:00`)).replace('.', '')
    }));
  }, [report]);

  const categoryRows = useMemo(() => {
    const rows = report?.salesByCategory || [];
    const total = rows.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) || 1;
    return rows.map((item) => ({
      ...item,
      amount: Number(item.total_amount || 0),
      share: Math.round((Number(item.total_amount || 0) / total) * 100)
    }));
  }, [report]);

  const paymentRows = useMemo(() => {
    const rows = report?.paymentMethods || [];
    const total = rows.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) || 1;
    return rows.map((item) => ({
      ...item,
      amount: Number(item.total_amount || 0),
      share: Math.round((Number(item.total_amount || 0) / total) * 100)
    }));
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
    <div className="space-y-6 orbit-reports-page">
      <Panel className="orbit-reports-toolbar">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold text-ink">Reportes</h2>
            <div className="mt-2 text-sm text-slate-600">
              Analiza el desempeño de tu supermercado, carnicería y deli.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="orbit-report-range-control">
              <span aria-hidden="true">▣</span>
              <Select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}>
                <option value="today">Hoy</option>
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="custom">Personalizado</option>
              </Select>
            </div>
            <Button onClick={exportCsv} disabled={!report}>
              ↓ Exportar
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!report || exportingPdf}>
              {exportingPdf ? 'Exportando PDF...' : 'PDF'}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto]">
          <Field label="Desde">
            <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, range: 'custom' }))} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value, range: 'custom' }))} />
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={() => loadReport(filters, { forceFresh: true })}>
              Actualizar datos
            </Button>
          </div>
        </div>
      </Panel>

      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      ) : null}

      <Panel className="orbit-reports-metrics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold ${
                card.tone === 'green' ? 'bg-emerald-100 text-emerald-700' :
                card.tone === 'blue' ? 'bg-blue-100 text-blue-700' :
                card.tone === 'violet' ? 'bg-violet-100 text-violet-700' :
                'bg-amber-100 text-amber-700'
              }`}>{card.icon}</div>
              <div className="mt-4 text-sm font-medium text-slate-600">{card.label}</div>
              <div className="mt-2 text-2xl font-bold text-ink">{loading ? '...' : card.value}</div>
              <div className="mt-2 text-xs font-semibold text-emerald-600">↗ &nbsp;Periodo seleccionado</div>
              <div className="mt-1 text-xs text-slate-500">vs. periodo anterior</div>
            </div>
          ))}
        </div>
      </Panel>

      {report ? (
        <Panel className="overflow-hidden orbit-reports-chart-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-ink">Ventas netas</div>
              <div className="mt-1 text-sm text-slate-500">Comportamiento diario del periodo seleccionado</div>
            </div>
            <div className="flex items-center gap-5 text-sm text-slate-600">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />Ventas netas (RD$)</span>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Por día⌄</div>
            </div>
          </div>
          <div className="orbit-reports-chart mt-7 flex h-64 items-end gap-2 border-b border-slate-200 px-2 pb-8 sm:gap-4">
            {salesByDay.length ? salesByDay.map((point) => (
              <div key={point.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[10px] font-semibold text-slate-700">{formatCurrency(point.amount)}</div>
                <div className="w-full max-w-16 rounded-t-lg bg-emerald-500 transition group-hover:bg-emerald-600" style={{ height: `${point.height}%` }} title={formatCurrency(point.amount)} />
                <div className="text-xs capitalize text-slate-500">{point.label}</div>
              </div>
            )) : (
              <div className="w-full pb-8 text-center text-sm text-slate-500">No hay ventas en el periodo seleccionado.</div>
            )}
          </div>
        </Panel>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel className="overflow-hidden orbit-report-table-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-ink">Top productos</h3>
                <button type="button" className="text-sm font-semibold text-sky-600">Ver todas</button>
              </div>
              <div className="orbit-report-table-head mt-4 grid grid-cols-[1.5rem,minmax(0,1fr),4.5rem,5rem] gap-2 text-[11px] font-semibold text-slate-500">
                <span>#</span><span>Producto</span><span>Cant.</span><span>Ventas (RD$)</span>
              </div>
              <div className="mt-2 divide-y divide-slate-100">
                {report.topProducts.slice(0, 5).map((item, index) => {
                  const imageUrl = resolveAssetUrl(item.image_path);
                  return (
                    <div key={item.product_name} className="grid grid-cols-[1.5rem,minmax(0,1fr),4.5rem,5rem] items-center gap-2 py-3 text-xs">
                      <span className="text-slate-500">{index + 1}</span>
                      <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                        {imageUrl ? <img src={imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">{getInitials(item.product_name)}</span>}
                        <span className="truncate">{item.product_name}</span>
                      </span>
                      <span className="text-slate-600">{item.quantity}</span>
                      <span className="text-right font-semibold text-slate-700">{formatCurrency(item.revenue).replace('RD$ ', '')}</span>
                    </div>
                  );
                })}
                {!report.topProducts.length ? <div className="py-5 text-sm text-slate-500">Sin productos en el periodo.</div> : null}
              </div>
            </Panel>

            <Panel className="overflow-hidden orbit-report-table-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-ink">Ventas por categoría</h3>
                <button type="button" className="text-sm font-semibold text-sky-600">Ver todas</button>
              </div>
              <div className="orbit-report-table-head mt-4 grid grid-cols-[minmax(0,1fr),5rem,5.5rem] gap-2 text-[11px] font-semibold text-slate-500">
                <span>Categoría</span><span>Ventas (RD$)</span><span>Participación</span>
              </div>
              <div className="mt-2 divide-y divide-slate-100">
                {categoryRows.map((item) => (
                  <div key={item.category} className="grid grid-cols-[minmax(0,1fr),5rem,5.5rem] items-center gap-2 py-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${categoryTone(item.category)}`}>◆</span><span className="truncate">{item.category}</span></span>
                    <span className="text-slate-600">{formatCurrency(item.amount).replace('RD$ ', '')}</span>
                    <span className="flex items-center gap-2 text-slate-600"><span>{item.share}%</span><span className="h-2 w-12 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(item.share, 4)}%` }} /></span></span>
                  </div>
                ))}
                {!categoryRows.length ? <div className="py-5 text-sm text-slate-500">Sin categorías en el periodo.</div> : null}
              </div>
            </Panel>

            <Panel className="overflow-hidden orbit-report-table-card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-ink">Métodos de pago</h3>
                <button type="button" className="text-sm font-semibold text-sky-600">Ver todas</button>
              </div>
              <div className="orbit-report-table-head mt-4 grid grid-cols-[minmax(0,1fr),5rem,5.5rem] gap-2 text-[11px] font-semibold text-slate-500">
                <span>Método</span><span>Ventas (RD$)</span><span>Participación</span>
              </div>
              <div className="mt-2 divide-y divide-slate-100">
                {paymentRows.map((item) => (
                  <div key={item.method} className="grid grid-cols-[minmax(0,1fr),5rem,5.5rem] items-center gap-2 py-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">▣</span><span className="truncate">{paymentLabel(item.method)}</span></span>
                    <span className="text-slate-600">{formatCurrency(item.amount).replace('RD$ ', '')}</span>
                    <span className="flex items-center gap-2 text-slate-600"><span>{item.share}%</span><span className="h-2 w-12 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(item.share, 4)}%` }} /></span></span>
                  </div>
                ))}
                {!paymentRows.length ? <div className="py-5 text-sm text-slate-500">Sin pagos en el periodo.</div> : null}
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.04fr),minmax(340px,0.96fr)]">
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
        </>
      ) : null}
    </div>
  );
}
