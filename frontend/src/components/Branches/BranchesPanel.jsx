import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';

const emptyForm = { id: null, name: '', address: '', phone: '', active: true };

function BranchIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h16M5 10v9h14v-9M3 10l2-5h14l2 5M8 14h3v5H8zM16 14h-2v5h2z" />
    </svg>
  );
}

function StatCard({ icon, label, value, detail, tone = 'emerald' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' };
  return (
    <div className="orbit-kpi flex items-center gap-4">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tones[tone] || tones.emerald}`}>
        {icon === 'users' ? (
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0111 0M16 11a2.5 2.5 0 100-5M16 14.5a4.5 4.5 0 014.5 4.5" /></svg>
        ) : <BranchIcon className="h-7 w-7" />}
      </span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-slate-600">{label}</span><strong className="mt-1 block text-2xl font-bold text-ink">{value}</strong><span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
    </div>
  );
}

export default function BranchesPanel({ token, onActivity, onNavigate }) {
  const [branches, setBranches] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const activeBranches = useMemo(() => branches.filter((branch) => Number(branch.active) === 1).length, [branches]);
  const visibleBranches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return branches;
    return branches.filter((branch) => `${branch.name} ${branch.address} ${branch.phone}`.toLowerCase().includes(normalizedSearch));
  }, [branches, search]);
  const selectedBranch = branches.find((branch) => branch.id === form.id) || branches[0] || null;

  async function loadBranches() {
    const [branchesResult, usersResult] = await Promise.all([apiRequest('/api/branches', { token }), apiRequest('/api/users', { token })]);
    setBranches(branchesResult);
    setUsersCount(usersResult.length);
    if (!form.id && branchesResult[0]) setForm({ ...branchesResult[0], active: Boolean(branchesResult[0].active) });
  }

  useEffect(() => { loadBranches().catch((error) => setMessage(error.message)); }, [token]);

  function selectBranch(branch) {
    setForm({ ...branch, active: Boolean(branch.active) });
    setEditorOpen(false);
    setMessage('');
  }

  function startNewBranch() {
    setForm(emptyForm);
    setEditorOpen(true);
    setMessage('');
  }

  function startEditBranch() {
    if (!selectedBranch) return startNewBranch();
    setForm({ ...selectedBranch, active: Boolean(selectedBranch.active) });
    setEditorOpen(true);
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (form.id) {
        await apiRequest(`/api/branches/${form.id}`, { method: 'PUT', body: form, token });
        setMessage('Sucursal actualizada.');
      } else {
        await apiRequest('/api/branches', { method: 'POST', body: form, token });
        setMessage('Sucursal creada.');
      }
      await loadBranches();
      setEditorOpen(false);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="text-xs uppercase tracking-[0.24em] text-slate-500">Administración</div><h2 className="mt-2 text-3xl font-bold text-ink">Sucursales</h2><p className="mt-2 text-sm text-slate-600">Administra las sucursales y puntos de venta de tu negocio.</p></div>
        <Button type="button" onClick={startNewBranch} className="shrink-0"><span className="mr-2 text-lg leading-none">+</span>Nueva sucursal</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Sucursales activas" value={activeBranches} detail={`de ${branches.length} registradas`} />
        <StatCard label="Sucursales registradas" value={branches.length} detail="puntos de venta configurados" tone="blue" />
        <StatCard label="Usuarios asignados" value={usersCount} detail="usuarios en el negocio" tone="violet" icon="users" />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <Panel className="min-w-0 overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-bold text-ink">Lista de sucursales</h3><p className="mt-1 text-sm text-slate-500">Selecciona una sucursal para consultar o editar sus datos.</p></div><label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 sm:w-56"><svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 w-full border-0 bg-transparent text-sm text-ink outline-none" placeholder="Buscar sucursales..." aria-label="Buscar sucursales" /></label></div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-slate-50/80 text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3 font-semibold">Nombre</th><th className="px-4 py-3 font-semibold">Dirección</th><th className="px-4 py-3 font-semibold">Teléfono</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">
              {visibleBranches.map((branch) => {
                const isSelected = selectedBranch?.id === branch.id;
                return <tr key={branch.id} className={isSelected ? 'bg-emerald-50/80' : 'bg-white hover:bg-slate-50/80'}><td className="px-5 py-4"><button type="button" className="flex items-center gap-3 text-left" onClick={() => selectBranch(branch)}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><BranchIcon className="h-5 w-5" /></span><span className="min-w-0"><strong className="block truncate text-ink">{branch.name}</strong><span className="mt-1 block text-xs text-slate-500">SUC-{String(branch.id).padStart(3, '0')}</span></span></button></td><td className="max-w-[210px] px-4 py-4 text-slate-600">{branch.address || 'Sin dirección'}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{branch.phone || 'Sin teléfono'}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${Number(branch.active) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><span className={`h-2 w-2 rounded-full ${Number(branch.active) === 1 ? 'bg-emerald-600' : 'bg-slate-400'}`} />{Number(branch.active) === 1 ? 'Activa' : 'Inactiva'}</span></td><td className="px-5 py-4 text-right"><button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-white" onClick={() => selectBranch(branch)} aria-label={`Ver ${branch.name}`}>•••</button></td></tr>;
              })}
            </tbody></table>
            {!visibleBranches.length ? <div className="px-5 py-12 text-center text-sm text-slate-500">No hay sucursales que coincidan con la búsqueda.</div> : null}
          </div>
          <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Mostrando {visibleBranches.length} de {branches.length} sucursales</div>
        </Panel>

        <Panel className="min-w-0">
          {editorOpen ? <form onSubmit={handleSubmit} className="space-y-4"><div><div className="text-xs uppercase tracking-[0.2em] text-slate-500">{form.id ? 'Editar sucursal' : 'Nueva sucursal'}</div><h3 className="mt-2 text-xl font-bold text-ink">{form.id ? form.name : 'Registrar sucursal'}</h3></div><Field label="Nombre"><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field><Field label="Teléfono"><Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></Field><Field label="Dirección"><TextArea rows={4} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></Field><label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Sucursal activa</label>{message ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}<div className="flex gap-3"><Button type="submit" disabled={saving}>{saving ? 'Guardando...' : form.id ? 'Actualizar sucursal' : 'Crear sucursal'}</Button><Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancelar</Button></div></form> : selectedBranch ? <div className="flex h-full flex-col"><div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><BranchIcon className="h-6 w-6" /></span><div className="min-w-0"><h3 className="truncate text-xl font-bold text-ink">{selectedBranch.name}</h3><p className="mt-1 text-sm text-slate-500">SUC-{String(selectedBranch.id).padStart(3, '0')}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(selectedBranch.active) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{Number(selectedBranch.active) === 1 ? 'Activa' : 'Inactiva'}</span></div><div className="divide-y divide-slate-100 py-3 text-sm"><div className="flex gap-3 py-4"><BranchIcon className="h-5 w-5 shrink-0 text-slate-500" /><span><span className="block text-slate-500">Dirección</span><strong className="mt-1 block font-semibold text-ink">{selectedBranch.address || 'Sin dirección registrada'}</strong></span></div><div className="flex gap-3 py-4"><svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.5a14 14 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2 2C10.5 19.5 4.5 13.5 4.5 6a2 2 0 012-2.5z" /></svg><span><span className="block text-slate-500">Teléfono</span><strong className="mt-1 block font-semibold text-ink">{selectedBranch.phone || 'Sin teléfono registrado'}</strong></span></div><div className="flex gap-3 py-4"><svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M8 9h8M8 13h5" /></svg><span><span className="block text-slate-500">Usuarios asignados</span><strong className="mt-1 block font-semibold text-ink">{usersCount} usuarios</strong></span></div></div><div className="mt-auto grid gap-3 pt-4"><Button type="button" onClick={startEditBranch}>Editar sucursal</Button><Button type="button" variant="secondary" onClick={() => setMessage('Los reportes de sucursal estarán disponibles al seleccionar un rango de fechas.')}>Ver reportes</Button></div>{message ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}</div> : <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-slate-500">Crea una sucursal para comenzar.</div>}
        </Panel>
      </div>
    </div>
  );
}
