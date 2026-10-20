import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';
import { getBusinessCategories } from '../../lib/businessProfile';

const emptyForm = {
  id: null,
  name: '',
  barcode: '',
  category: '',
  image_path: '',
  cost_price: '',
  sale_price: '',
  stock: '1',
  min_stock: '5',
  unit: 'unidad',
  weighed: false,
  active: true
};

function ProductImagePreview({ product, className = 'h-16 w-16 rounded-[18px]' }) {
  const imageUrl = resolveAssetUrl(product?.image_path);
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={product?.name || 'Producto'}
        className={`${className} shrink-0 border border-white/70 object-cover shadow-sm`}
      />
    );
  }

  return (
    <div className={`${className} flex shrink-0 items-center justify-center border border-white/70 bg-ink/10 text-sm font-bold text-ink shadow-sm`}>
      {getInitials(product?.name || 'Producto')}
    </div>
  );
}

export default function ProductsPanel({ token, businessType = 'colmado', inventoryLabel = 'Productos e inventario', onActivity }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [visibleProductCount, setVisibleProductCount] = useState(40);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const categoryOptions = useMemo(() => getBusinessCategories(businessType), [businessType]);
  const categoryFilters = useMemo(() => ['Todos', ...categoryOptions], [categoryOptions]);
  const selectedProduct = products.find((product) => product.id === form.id) || null;
  const lowStockCount = useMemo(
    () => products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0)).length,
    [products]
  );
  const lowStockProducts = useMemo(
    () => products
      .filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0))
      .sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0))
      .slice(0, 4),
    [products]
  );
  const inventorySummary = useMemo(() => ({
    total: products.length,
    inStock: products.filter((product) => Number(product.stock || 0) > Number(product.min_stock || 0)).length,
    lowStock: lowStockCount,
    outOfStock: products.filter((product) => Number(product.stock || 0) <= 0).length
  }), [lowStockCount, products]);
  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'Todos') return products;
    const normalizedCategory = categoryFilter.toLowerCase();
    return products.filter((product) => String(product.category || '').toLowerCase() === normalizedCategory);
  }, [categoryFilter, products]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductCount),
    [filteredProducts, visibleProductCount]
  );

  useEffect(() => {
    if (categoryFilter !== 'Todos' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('Todos');
    }
  }, [categoryFilter, categoryOptions]);

  async function loadProducts(search = '', { forceFresh = false } = {}) {
    const normalizedSearch = search.trim().toLowerCase();
    const result = await apiRequest(`/api/products?q=${encodeURIComponent(search)}`, {
      token,
      cacheMs: forceFresh ? 0 : 20000,
      cacheKey: `products-list:${normalizedSearch}`,
      forceFresh
    });
    setProducts(result);
    setVisibleProductCount(normalizedSearch ? 60 : 40);
  }

  useEffect(() => {
    loadProducts();
  }, [token]);

  async function chooseProductImage() {
    try {
      const filePath = await window.orbit?.files?.pickProductImage?.();
      if (!filePath) {
        return;
      }
      setForm((current) => ({ ...current, image_path: filePath }));
    } catch (error) {
      setMessage('No fue posible seleccionar la imagen del producto.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        image_path: String(form.image_path || '').trim(),
        cost_price: Number(form.cost_price || 0),
        sale_price: Number(form.sale_price || 0),
        stock: Number(form.stock || 0),
        min_stock: Number(form.min_stock || 0)
      };

      if (form.id) {
        await apiRequest(`/api/products/${form.id}`, {
          method: 'PUT',
          body: payload,
          token
        });
        setMessage('Producto actualizado.');
      } else {
        await apiRequest('/api/products', {
          method: 'POST',
          body: payload,
          token
        });
        setMessage('Producto creado.');
      }

      setForm(emptyForm);
      await loadProducts(query, { forceFresh: true });
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const selectProduct = (product) => setForm({
    ...product,
    image_path: product.image_path || '',
    cost_price: String(product.cost_price),
    sale_price: String(product.sale_price),
    stock: String(product.stock),
    min_stock: String(product.min_stock),
    weighed: Boolean(product.weighed),
    active: Boolean(product.active)
  });

  return (
    <div className="orbit-products-page space-y-6">
      <div className="orbit-products-heading flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-4xl font-bold text-ink">Productos e inventario</h2>
          <p className="mt-2 text-base text-slate-600">Gestiona tu catálogo de productos, precios y existencias.</p>
        </div>
        <Button
          className="orbit-primary-button shrink-0"
          onClick={() => {
            setForm(emptyForm);
            document.getElementById('orbit-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          + Nuevo producto
        </Button>
      </div>

      <div className="orbit-products-layout grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
        <Panel className="orbit-products-table-card overflow-hidden">
          <div className="orbit-products-toolbar flex flex-col gap-4 lg:flex-row lg:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadProducts(event.currentTarget.value);
              }}
              placeholder="Buscar por nombre, código o categoría..."
            />
            <div className="text-sm text-slate-500">{filteredProducts.length} producto(s)</div>
          </div>

          <div className="orbit-products-category-row mt-5 flex flex-wrap gap-2">
            {categoryFilters.map((category) => (
              <button
                key={category}
                type="button"
                className={`orbit-products-category ${categoryFilter === category ? 'is-active' : ''}`}
                onClick={() => {
                  setCategoryFilter(category);
                  setVisibleProductCount(40);
                }}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="orbit-products-table-wrap soft-scrollbar mt-5 overflow-auto">
            <table className="orbit-products-table w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Precio</th><th>Estado</th><th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length ? visibleProducts.map((product) => {
                  const isLowStock = Number(product.stock || 0) <= Number(product.min_stock || 0);
                  const isSelected = selectedProduct?.id === product.id;
                  return (
                    <tr key={product.id} className={isSelected ? 'is-selected' : ''} onClick={() => selectProduct(product)}>
                      <td>
                        <div className="flex min-w-[190px] items-center gap-3">
                          <ProductImagePreview product={product} className="h-12 w-12 rounded-[10px]" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">{product.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{product.barcode || 'Sin código'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="orbit-products-pill">{product.category || 'Sin categoría'}</span></td>
                      <td className={isLowStock ? 'font-bold text-rosewood' : 'font-semibold text-ink'}>{product.stock} <small>{product.unit || 'un'}</small></td>
                      <td className="text-slate-700">{product.min_stock} <small>{product.unit || 'un'}</small></td>
                      <td className="whitespace-nowrap text-slate-700">RD$ {Number(product.cost_price || 0).toFixed(2)}</td>
                      <td className="whitespace-nowrap font-medium text-slate-700">RD$ {Number(product.sale_price || 0).toFixed(2)}</td>
                      <td><span className={`orbit-products-status ${isLowStock ? 'is-low' : 'is-good'}`}><i />{isLowStock ? 'Bajo stock' : 'En stock'}</span></td>
                      <td><button type="button" className="orbit-products-more" aria-label={`Editar ${product.name}`} onClick={(event) => { event.stopPropagation(); selectProduct(product); }}>⋮</button></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="8" className="py-10 text-center text-slate-500">No se encontraron productos con ese criterio.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <span>Mostrando {Math.min(visibleProductCount, filteredProducts.length)} de {filteredProducts.length} productos</span>
            {filteredProducts.length > visibleProductCount ? <Button variant="secondary" onClick={() => setVisibleProductCount((current) => current + 30)}>Mostrar más</Button> : null}
          </div>
        </Panel>

        <div className="orbit-products-side grid content-start gap-6">
        <Panel id="orbit-product-form">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {form.id ? 'Editar producto' : 'Nuevo producto'}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-ink">
                {selectedProduct ? selectedProduct.name : 'Registrar producto'}
              </h3>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado actual</div>
              <div className={`mt-2 text-lg font-bold ${Number(selectedProduct?.stock || 0) <= Number(selectedProduct?.min_stock || 0) && selectedProduct ? 'text-rosewood' : 'text-ink'}`}>
                {selectedProduct ? `Stock ${selectedProduct.stock}` : 'Sin seleccion'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),260px]">
              <div className="grid gap-5">
                <Field label="Nombre">
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Codigo de barras">
                    <Input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} />
                  </Field>
                  <Field label="Categoria">
                    <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                      <option value="">Seleccionar categoria</option>
                      {form.category && !categoryOptions.includes(form.category) ? <option value={form.category}>{form.category}</option> : null}
                      {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                    </Select>
                  </Field>
                  <Field label="Costo">
                    <Input type="number" step="0.01" value={form.cost_price} onChange={(event) => setForm((current) => ({ ...current, cost_price: event.target.value }))} />
                  </Field>
                  <Field label="Precio venta">
                    <Input type="number" step="0.01" value={form.sale_price} onChange={(event) => setForm((current) => ({ ...current, sale_price: event.target.value }))} />
                  </Field>
                  <Field label="Stock inicial" hint="Se usa para vender de inmediato">
                    <Input type="number" step="0.01" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} />
                  </Field>
                  <Field label="Stock minimo">
                    <Input type="number" step="0.01" value={form.min_stock} onChange={(event) => setForm((current) => ({ ...current, min_stock: event.target.value }))} />
                  </Field>
                </div>
              </div>

              <div className="rounded-[24px] bg-white/76 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Imagen del producto</div>
                <div className="mt-4 flex justify-center">
                  <ProductImagePreview product={form} className="h-40 w-40 rounded-[24px]" />
                </div>
                <div className="mt-4 space-y-3">
                  <Button className="w-full" variant="secondary" onClick={chooseProductImage}>
                    Seleccionar imagen
                  </Button>
                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={() => setForm((current) => ({ ...current, image_path: '' }))}
                  >
                    Quitar imagen
                  </Button>
                  <Field label="Ruta de imagen" hint="Opcional">
                    <Input
                      value={form.image_path}
                      onChange={(event) => setForm((current) => ({ ...current, image_path: event.target.value }))}
                      placeholder="C:\\Imagenes\\producto.png"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),240px]">
              <Field label="Unidad">
                <Select value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}>
                  <option value="unidad">Unidad</option>
                  <option value="libra">Libra</option>
                  <option value="kg">Kg</option>
                  <option value="litro">Litro</option>
                </Select>
              </Field>
              <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.weighed} onChange={(event) => setForm((current) => ({ ...current, weighed: event.target.checked }))} />
                Producto por peso
              </label>
            </div>

            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : form.id ? 'Actualizar producto' : 'Crear producto'}
              </Button>
              <Button variant="ghost" onClick={() => setForm(emptyForm)}>
                Limpiar
              </Button>
            </div>
          </form>
        </Panel>
        <Panel className="orbit-low-stock-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-rosewood">Inventario</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Productos con bajo stock</h3>
              <p className="mt-2 text-sm text-slate-600">Revisa lo que necesita reposicion antes de quedarte sin existencia.</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff0eb] text-2xl font-bold text-rosewood">
              {lowStockCount}
            </div>
          </div>
          <div className="mt-5 divide-y divide-slate-100 rounded-[18px] border border-slate-100 bg-white">
            {lowStockProducts.length ? lowStockProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                onClick={() => selectProduct(product)}
              >
                <ProductImagePreview product={product} className="h-12 w-12 rounded-[12px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{product.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{product.stock} / {product.min_stock} {product.unit || 'un'}</span>
                </span>
                <span className="text-sm font-bold text-rosewood">Reponer</span>
              </button>
            )) : (
              <div className="px-4 py-5 text-sm text-slate-500">No hay productos en nivel critico.</div>
            )}
          </div>
          <div className="mt-4 rounded-[16px] bg-[#eefaf5] px-4 py-3 text-sm font-semibold text-[#087c55]">
            {lowStockCount ? `${lowStockCount} producto(s) necesitan reposicion.` : 'Todo el inventario esta en orden.'}
          </div>
        </Panel>
        <Panel className="orbit-inventory-summary">
          <h3 className="text-xl font-bold text-ink">Resumen de inventario</h3>
          <div className="mt-4 divide-y divide-slate-100">
            <div><span className="orbit-summary-icon">▣</span><span>Total de productos</span><strong>{inventorySummary.total}</strong></div>
            <div><span className="orbit-summary-icon is-good">✓</span><span>Con stock</span><strong>{inventorySummary.inStock}</strong></div>
            <div><span className="orbit-summary-icon is-warn">!</span><span>Con bajo stock</span><strong className="text-orange-600">{inventorySummary.lowStock}</strong></div>
            <div><span className="orbit-summary-icon is-danger">×</span><span>Sin stock</span><strong className="text-red-600">{inventorySummary.outOfStock}</strong></div>
          </div>
          <button type="button" className="orbit-outline-action mt-5 w-full" onClick={() => setCategoryFilter('Todos')}>▥ Ver reporte de inventario</button>
        </Panel>
        </div>
      </div>
      <div className="sr-only">{inventoryLabel}</div>
    </div>
  );
}
