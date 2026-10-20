import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { getBusinessCategories } from '../../lib/businessProfile';
import { resolveAssetUrl } from '../../lib/assets';
import Button from '../ui/Button';
import Panel from '../ui/Panel';

const metricIcons = {
  sales: 'M6 17V9m6 8V5m6 12v-6',
  transactions: 'M4 5h16v14H4zM8 9h8M8 13h5',
  stock: 'M12 3l8 4.5-8 4.5-8-4.5L12 3zm-7 8v6l7 4 7-4v-6',
  receivables: 'M12 3v18m4-15.5c-.9-.4-2-.6-3.3-.6-2.6 0-4.2 1.2-4.2 3s1.6 2.7 4.2 3.2 4.2 1.1 4.2 3.2-1.7 3.4-4.6 3.4c-1.5 0-2.9-.4-4-1'
};

function MetricIcon({ name }) {
  return (
    <span className={`orbit-dashboard-metric-icon orbit-dashboard-metric-icon-${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={metricIcons[name]} />
      </svg>
    </span>
  );
}

function ProductThumb({ product }) {
  const imageUrl = resolveAssetUrl(product?.image_path);
  return imageUrl ? (
    <img className="orbit-dashboard-product-thumb" src={imageUrl} alt={product.name} />
  ) : (
    <span className="orbit-dashboard-product-thumb orbit-dashboard-product-thumb-empty" aria-hidden="true">
      {String(product?.name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

function SummaryCard({ label, value, helper, icon, trend = 'Disponible' }) {
  return (
    <div className="orbit-dashboard-metric orbit-kpi">
      <MetricIcon name={icon} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-600">{label}</div>
        <div className="mt-2 truncate text-2xl font-extrabold tracking-tight text-ink">{value}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {trend ? <span className="orbit-dashboard-trend">↗ {trend}</span> : null}
          <span>{helper}</span>
        </div>
      </div>
    </div>
  );
}

function WeeklySales({ chart }) {
  const points = chart.length ? chart.slice(-7) : [
    { label: 'Lun', total: 0 }, { label: 'Mar', total: 0 }, { label: 'Mié', total: 0 },
    { label: 'Jue', total: 0 }, { label: 'Vie', total: 0 }, { label: 'Sáb', total: 0 }, { label: 'Dom', total: 0 }
  ];
  const max = Math.max(...points.map((point) => Number(point.total || 0)), 1);

  return (
    <div className="orbit-dashboard-chart" aria-label="Ventas de la semana">
      <div className="orbit-dashboard-chart-grid" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="orbit-dashboard-bars">
        {points.map((point, index) => {
          const value = Number(point.total || 0);
          const height = value ? Math.max(8, Math.round((value / max) * 100)) : 4;
          return (
            <div className="orbit-dashboard-bar-column" key={`${point.label}-${index}`}>
              <span className="orbit-dashboard-bar-value">{value ? formatCurrency(value) : 'RD$0'}</span>
              <span className="orbit-dashboard-bar" style={{ height: `${height}%` }} />
              <span className="orbit-dashboard-bar-label">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardHome({ token, businessType = 'colmado', refreshKey = 0, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [error, setError] = useState('');
  const [productLoadError, setProductLoadError] = useState('');
  const categories = useMemo(() => ['Todos', ...getBusinessCategories(businessType)], [businessType]);

  useEffect(() => {
    let isMounted = true;
    setError('');
    setProductLoadError('');

    apiRequest('/api/dashboard/summary', {
      token,
      cacheMs: refreshKey > 0 ? 0 : 12000,
      cacheKey: 'dashboard-summary',
      forceFresh: refreshKey > 0
    })
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch((dashboardError) => {
        if (isMounted) setError(dashboardError.message);
      });

    apiRequest('/api/products', {
      token,
      cacheMs: refreshKey > 0 ? 0 : 20000,
      cacheKey: 'dashboard-products',
      forceFresh: refreshKey > 0
    })
      .then((data) => {
        if (isMounted) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((productError) => {
        if (isMounted) setProductLoadError(productError.message);
      });

    return () => {
      isMounted = false;
    };
  }, [token, refreshKey]);

  const filteredProducts = useMemo(() => {
    const source = categoryFilter === 'Todos'
      ? products
      : products.filter((product) => String(product.category || '').toLowerCase() === categoryFilter.toLowerCase());
    return source.slice(0, 12);
  }, [categoryFilter, products]);

  const lowStockProducts = useMemo(
    () => products
      .filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0))
      .sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0))
      .slice(0, 4),
    [products]
  );

  if (error) return <Panel><div className="text-sm text-red-700">{error}</div></Panel>;
  if (!summary) return <Panel><div className="text-sm text-slate-600">Cargando panel principal...</div></Panel>;

  return (
    <div className="orbit-dashboard-page space-y-5">
      <div className="orbit-dashboard-title-row">
        <div><h2 className="text-4xl font-extrabold tracking-tight text-ink">Resumen del negocio</h2></div>
        <button type="button" className="orbit-dashboard-date">Hoy, {formatDate(new Date())}<span aria-hidden="true">⌄</span></button>
      </div>

      <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
        <SummaryCard label="Ventas de hoy" value={formatCurrency(summary.salesToday)} icon="sales" trend="12%" helper="vs. ayer" />
        <SummaryCard label="Transacciones" value={summary.transactionsToday || 0} icon="transactions" trend="9%" helper="Ventas registradas hoy" />
        <SummaryCard label="Inventario bajo" value={summary.lowStockCount || 0} icon="stock" trend="!" helper="Productos necesitan reposición" />
        <SummaryCard label="Cuentas por cobrar" value={formatCurrency(summary.receivables)} icon="receivables" trend="" helper="Saldo pendiente de clientes" />
      </div>

      <div className="orbit-dashboard-workspace grid gap-3 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Panel className="orbit-dashboard-sale-panel p-0">
          <div className="orbit-dashboard-section-heading">
            <div className="flex items-center gap-3"><span className="orbit-dashboard-heading-icon" aria-hidden="true">🛒</span><h3>Nueva venta</h3></div>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => onNavigate?.('pos')}>Cliente</Button><Button variant="ghost" onClick={() => onNavigate?.('pos')}>Limpiar</Button></div>
          </div>
          <div className="orbit-dashboard-sale-table">
            <div className="orbit-dashboard-table-head"><span>Producto</span><span>Precio</span><span>Cant.</span><span>Subtotal</span><span /></div>
            <div className="orbit-dashboard-empty-sale">Agrega productos desde Ventas para iniciar un carrito.</div>
          </div>
          <div className="orbit-dashboard-sale-footer">
            <button type="button" className="orbit-dashboard-scan" onClick={() => onNavigate?.('pos')}><span aria-hidden="true">▥</span> Escanear código de barras <small>o buscar producto por nombre o código</small><b>⌕</b></button>
            <div className="orbit-dashboard-totals"><span>Subtotal <b>{formatCurrency(summary.salesToday)}</b></span><span>Impuestos <b>Calculados al cobrar</b></span><strong>Total <em>{formatCurrency(summary.salesToday)}</em></strong></div>
          </div>
          <div className="orbit-dashboard-note"><span>▧</span> Agregar nota (opcional)</div>
          <Button className="orbit-dashboard-charge" onClick={() => onNavigate?.('pos')}>▣ &nbsp; Cobrar <span>{formatCurrency(summary.salesToday)} &nbsp;→</span></Button>
        </Panel>

        <Panel className="orbit-dashboard-catalog-panel p-0">
          <div className="orbit-dashboard-category-tabs">
            {categories.slice(0, 7).map((category) => <button type="button" className={categoryFilter === category ? 'is-active' : ''} key={category} onClick={() => setCategoryFilter(category)}>{category}</button>)}
          </div>
          <div className="orbit-dashboard-catalog-grid">
            {filteredProducts.length ? filteredProducts.map((product) => (
              <button type="button" className="orbit-dashboard-product-card" key={product.id} onClick={() => onNavigate?.('pos')} aria-label={`Agregar ${product.name} en Ventas`}>
                <ProductThumb product={product} /><span className="orbit-dashboard-product-name">{product.name}</span><strong>{formatCurrency(product.sale_price)}</strong>
              </button>
            )) : <div className="orbit-dashboard-empty-catalog">{productLoadError || 'No hay productos en esta categoría.'}</div>}
          </div>
        </Panel>
      </div>

      <div className="orbit-dashboard-bottom-grid grid gap-3 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <Panel className="orbit-dashboard-alerts-panel p-0">
          <div className="orbit-dashboard-section-heading"><div className="flex items-center gap-3"><span className="orbit-dashboard-heading-icon orbit-dashboard-heading-icon-alert" aria-hidden="true">!</span><h3>Alertas de inventario</h3></div><button type="button" onClick={() => onNavigate?.('products')}>Ver todo</button></div>
          <div className="orbit-dashboard-alert-head"><span>Producto</span><span>Stock actual</span><span>Stock mínimo</span></div>
          {lowStockProducts.length ? lowStockProducts.map((product) => <div className="orbit-dashboard-alert-row" key={product.id}><span><ProductThumb product={product} />{product.name}</span><strong>{product.stock} {product.unit || 'un'}</strong><span>{product.min_stock} {product.unit || 'un'}</span></div>) : <div className="orbit-dashboard-empty-alerts">No hay productos con stock bajo.</div>}
        </Panel>
        <Panel className="orbit-dashboard-chart-panel p-0">
          <div className="orbit-dashboard-section-heading"><div className="flex items-center gap-3"><span className="orbit-dashboard-heading-icon" aria-hidden="true">▥</span><h3>Ventas de la semana</h3></div><span className="orbit-dashboard-filter">Últimos 7 días⌄</span></div>
          <WeeklySales chart={summary.chart || []} />
        </Panel>
      </div>
    </div>
  );
}
