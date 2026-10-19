import { useMemo, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
import wizardStorefrontUrl from '../../assets/wizard-storefront.png';

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.58';

export default function HelpPanel({ license, machineId, token, onReconfigure }) {
  const [query, setQuery] = useState('');

  const helpCards = useMemo(() => [
    { title: 'Guía rápida', description: 'Conoce lo esencial de OrbitPOS en pocos pasos.', icon: '▤', action: 'Ver guía', onClick: openManual },
    { title: 'Ventas y cobros', description: 'Aprende a registrar ventas, aplicar descuentos y emitir comprobantes.', icon: '▣', action: 'Ver artículos', onClick: () => setQuery('ventas') },
    { title: 'Inventario', description: 'Gestiona tus productos, precios, existencias y ajustes.', icon: '▦', action: 'Ver artículos', onClick: () => setQuery('inventario') },
    { title: 'Caja', description: 'Apertura, cierre, movimientos y arqueos de caja.', icon: '▥', action: 'Ver artículos', onClick: () => setQuery('caja') },
    { title: 'Licencias', description: 'Activa, renueva y administra tus licencias de OrbitPOS.', icon: '▧', action: 'Ver artículos', onClick: () => setQuery('licencia') }
  ], []);

  const filteredCards = helpCards.filter((card) => {
    const normalizedQuery = query.trim().toLowerCase();
    return !normalizedQuery || `${card.title} ${card.description}`.toLowerCase().includes(normalizedQuery);
  });

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
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-soft sm:px-8 xl:px-10">
        <img src={wizardStorefrontUrl} alt="Tienda OrbitPOS" className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-45" />
        <div className="absolute inset-y-0 right-0 w-3/4 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent" />
        <div className="relative max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">OrbitPOS v{APP_VERSION}</div>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Ayuda y soporte</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Encuentra respuestas, aprende a sacar el máximo de OrbitPOS y recibe asistencia de nuestro equipo.
          </p>
          <div className="mt-7 flex max-w-3xl flex-col gap-3 rounded-2xl bg-white p-2 shadow-lg sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
              <span className="text-2xl text-slate-400">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="¿Qué necesitas hacer?"
                className="min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <Button onClick={() => setQuery(query.trim())}>Buscar</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className="font-semibold">Ejemplos:</span>
            {[['Registrar una venta', 'ventas'], ['Ajustar inventario', 'inventario'], ['Cerrar caja', 'caja'], ['Imprimir etiqueta', 'inventario'], ['Activar una licencia', 'licencia']].map(([example, value]) => (
              <button key={example} type="button" onClick={() => setQuery(value)} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 transition hover:bg-white/20">
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {filteredCards.map((card) => (
          <Panel key={card.title} className="flex min-h-[245px] flex-col p-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-emerald-50 text-5xl font-bold text-emerald-700">{card.icon}</div>
            <h3 className="mt-5 text-xl font-bold text-ink">{card.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{card.description}</p>
            <Button onClick={card.onClick} className="mt-4 w-full">{card.action} <span aria-hidden="true">›</span></Button>
          </Panel>
        ))}
      </div>

      {!filteredCards.length ? (
        <Panel className="text-center text-sm text-slate-600">No encontramos un artículo con “{query}”. Prueba con ventas, inventario, caja o licencia.</Panel>
      ) : null}

      <Panel className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Soporte JRTech</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Estamos para ayudarte</h3>
            <p className="mt-2 text-sm text-slate-600">Contacta al equipo por el canal de tu preferencia.</p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white/75 p-4"><div className="text-slate-500">Teléfono</div><div className="mt-1 font-bold text-ink">809 404 2070</div><div className="text-xs text-slate-500">Lun - Vie · 8:00 a.m. - 6:00 p.m.</div></div>
            <div className="rounded-2xl bg-white/75 p-4"><div className="text-slate-500">WhatsApp</div><div className="mt-1 font-bold text-ink">809 404 2070</div><div className="text-xs text-slate-500">Respuesta rápida</div></div>
            <div className="rounded-2xl bg-white/75 p-4"><div className="text-slate-500">Correo</div><div className="mt-1 break-all font-bold text-ink">jrr6867@gmail.com</div><div className="text-xs text-slate-500">Soporte OrbitPOS</div></div>
            <div className="rounded-2xl bg-white/75 p-4"><div className="text-slate-500">Versión</div><div className="mt-1 font-bold text-ink">OrbitPOS v{APP_VERSION}</div><div className="text-xs text-emerald-700">Licencia {license?.status || 'Pendiente'}</div></div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-emerald-100 pt-5">
          <Button onClick={openManual}>Descargar manual PDF</Button>
          <Button variant="secondary" onClick={openSupport}>Contactar por WhatsApp</Button>
          <Button variant="ghost" onClick={onReconfigure}>Reconfigurar sistema</Button>
          <div className="ml-auto self-center text-xs text-slate-500">Machine ID: <span className="font-semibold">{machineId}</span> · {token ? 'Sesión iniciada' : 'Sin sesión'}</div>
        </div>
      </Panel>
    </div>
  );
}
