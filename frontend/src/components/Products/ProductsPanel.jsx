import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';

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

export default function ProductsPanel({ token, onActivity }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [visibleProductCount, setVisibleProductCount] = useState(40);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedProduct = products.find((product) => product.id === form.id) || null;
  const lowStockCount = useMemo(
    () => products.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0)).length,
    [products]
  );
  const visibleProducts = useMemo(
    () => products.slice(0, visibleProductCount),
    [products, visibleProductCount]
  );

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

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Inventario</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Productos y control base</h2>
            <p className="mt-3 text-sm text-slate-600">
              Organiza tu catalogo, define un stock inicial real y agrega imagen al producto para venderlo mas facil desde el POS.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[560px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Productos</div>
              <div className="mt-2 text-2xl font-bold text-ink">{products.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Stock bajo</div>
              <div className="mt-2 text-2xl font-bold text-rosewood">{lowStockCount}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Seleccionado</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedProduct?.name || 'Ninguno'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.92fr),minmax(0,1.08fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Catalogo</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Listado de productos</h3>
              <div className="mt-2 text-sm text-slate-500">Busca por nombre o codigo y selecciona para editar.</div>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadProducts(event.currentTarget.value);
                }
              }}
              placeholder="Buscar por nombre o codigo"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-white/75 px-3 py-2">Resultados: {products.length}</span>
            <span className="rounded-full bg-white/75 px-3 py-2">Stock critico: {lowStockCount}</span>
          </div>

          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-21rem)] space-y-3 overflow-auto pr-1">
            {visibleProducts.length ? visibleProducts.map((product) => {
              const isSelected = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setForm({
                    ...product,
                    image_path: product.image_path || '',
                    cost_price: String(product.cost_price),
                    sale_price: String(product.sale_price),
                    stock: String(product.stock),
                    min_stock: String(product.min_stock),
                    weighed: Boolean(product.weighed),
                    active: Boolean(product.active)
                  })}
                  className={`w-full rounded-[24px] p-4 text-left transition ${
                    isSelected ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <ProductImagePreview
                      product={product}
                      className={`h-16 w-16 rounded-[18px] ${isSelected ? 'border-white/20 bg-white/10 text-white' : ''}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{product.name}</div>
                          <div className={`mt-1 text-xs ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                            {product.category || 'Sin categoria'} | {product.barcode || 'Sin codigo'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">RD$ {Number(product.sale_price).toFixed(2)}</div>
                          <div className={`mt-1 text-xs ${isSelected ? 'text-white/75' : Number(product.stock) <= Number(product.min_stock) ? 'text-red-600' : 'text-slate-500'}`}>
                            Stock: {product.stock}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                No se encontraron productos con ese criterio.
              </div>
            )}
          </div>
          {products.length > visibleProductCount ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-white/72 px-4 py-3">
              <div className="text-sm text-slate-600">
                Mostrando {visibleProductCount} de {products.length} producto(s).
              </div>
              <Button variant="secondary" onClick={() => setVisibleProductCount((current) => current + 30)}>
                Mostrar mas
              </Button>
            </div>
          ) : null}
        </Panel>

        <Panel>
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
                    <Input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
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
      </div>
    </div>
  );
}
