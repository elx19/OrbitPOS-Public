import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';
import securityQuestions from '../../../../shared/security-questions.json';
import { PERMISSION_GROUPS, getDefaultPermissions, getEffectivePermissions } from '../../lib/userPermissions';

const emptyForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  role: 'cashier',
  branchId: '',
  active: true,
  securityQuestion: '',
  securityAnswer: '',
  permissions: getDefaultPermissions('cashier')
};

function mapUserToForm(user) {
  return {
    id: user.id,
    name: user.name || '',
    username: user.username || '',
    password: '',
    role: user.role || 'cashier',
    branchId: user.branch_id ? String(user.branch_id) : '',
    active: Boolean(user.active),
    securityQuestion: user.security_question || '',
    securityAnswer: '',
    permissions: getEffectivePermissions(user)
  };
}

function getSecurityQuestionOptions(currentQuestion = '') {
  const trimmedCurrent = String(currentQuestion || '').trim();
  return trimmedCurrent && !securityQuestions.includes(trimmedCurrent)
    ? [trimmedCurrent, ...securityQuestions]
    : securityQuestions;
}

function PermissionIcon({ name }) {
  const paths = {
    cart: 'M3 4h2l1.4 8.2a1 1 0 001 .8h8.8a1 1 0 001-.7L20 7H7.2M9 19a1.2 1.2 0 110 2.4A1.2 1.2 0 019 19zm8 0a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z',
    box: 'M12 3l8 4.5-8 4.5-8-4.5L12 3zm-7 7.4l7 4v6.1l-7-4v-6.1zm9 10.1v-6.1l7-4v6.1l-7 4z',
    report: 'M6 20V10M12 20V4M18 20v-7',
    settings: 'M12 8.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zm8.2 3.2l-1.8.6a6.7 6.7 0 00-.4 1l.8 1.8-1.8 1.8-1.8-.8c-.3.2-.7.3-1 .4l-.6 1.8h-2.6l-.6-1.8a6.7 6.7 0 01-1-.4l-1.8.8-1.8-1.8.8-1.8c-.2-.3-.3-.7-.4-1l-1.8-.6V10l1.8-.6c.1-.3.2-.7.4-1l-.8-1.8 1.8-1.8 1.8.8c.3-.2.7-.3 1-.4l.6-1.8h2.6l.6 1.8c.3.1.7.2 1 .4l1.8-.8 1.8 1.8-.8 1.8c.2.3.3.7.4 1l1.8.6V12z'
  };

  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.settings} /></svg>;
}

export default function UsersPanel({ token, onActivity }) {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedUser = users.find((user) => user.id === form.id) || null;
  const activeUsers = useMemo(
    () => users.filter((user) => Number(user.active) === 1).length,
    [users]
  );
  const administrators = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);
  const cashiers = useMemo(() => users.filter((user) => user.role === 'cashier').length, [users]);
  const visibleUsers = useMemo(() => users.filter((user) => {
    const text = `${user.name} ${user.username} ${user.branch_name || ''}`.toLowerCase();
    const matchesSearch = !search.trim() || text.includes(search.trim().toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? Number(user.active) === 1 : Number(user.active) !== 1);
    return matchesSearch && matchesRole && matchesStatus;
  }), [users, search, roleFilter, statusFilter]);

  async function loadData() {
    const [usersResult, branchesResult] = await Promise.all([
      apiRequest('/api/users', { token }),
      apiRequest('/api/branches', { token })
    ]);

    setUsers(usersResult);
    setBranches(branchesResult.filter((branch) => Number(branch.active) === 1));
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, [token]);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function isPermissionChecked(moduleKey, action) {
    return form.permissions === '*' || Boolean(form.permissions?.[moduleKey]?.includes(action));
  }

  function togglePermission(moduleKey, action) {
    if (form.role === 'admin') return;

    setForm((current) => {
      const nextPermissions = { ...(current.permissions || {}) };
      const actions = new Set(nextPermissions[moduleKey] || []);
      if (actions.has(action)) actions.delete(action);
      else actions.add(action);
      nextPermissions[moduleKey] = [...actions];
      return { ...current, permissions: nextPermissions };
    });
  }

  function editUser(user) {
    setForm(mapUserToForm(user));
    setMessage('');
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (form.id) {
        await apiRequest(`/api/users/${form.id}`, {
          method: 'PUT',
          token,
          body: {
            name: form.name,
            role: form.role,
            permissions: form.role === 'admin' ? null : form.permissions,
            active: form.active,
            branchId: form.branchId ? Number(form.branchId) : null,
            securityQuestion: form.securityQuestion,
            ...(form.securityAnswer.trim() ? { securityAnswer: form.securityAnswer } : {})
          }
        });

        if (form.password.trim()) {
          await apiRequest(`/api/users/${form.id}/password`, {
            method: 'PATCH',
            token,
            body: {
              password: form.password
            }
          });
        }

        setMessage('Usuario actualizado correctamente.');
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          token,
          body: {
            name: form.name,
            username: form.username,
            password: form.password,
            role: form.role,
            permissions: form.role === 'admin' ? null : form.permissions,
            branchId: form.branchId ? Number(form.branchId) : null,
            securityQuestion: form.securityQuestion,
            securityAnswer: form.securityAnswer
          }
        });

        setMessage('Usuario creado correctamente.');
      }

      setForm(emptyForm);
      await loadData();
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-ink">Usuarios y permisos</h2>
          <p className="mt-2 text-sm text-slate-600">Administra los usuarios del sistema y define sus permisos de acceso.</p>
        </div>
        <Button onClick={() => setForm(emptyForm)}>＋ Nuevo usuario</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-5"><div className="text-sm text-slate-600">Usuarios activos</div><div className="mt-2 text-3xl font-bold text-ink">{activeUsers}</div><div className="mt-1 text-xs text-slate-500">de {users.length} registrados</div></div>
        <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5"><div className="text-sm text-slate-600">Administradores</div><div className="mt-2 text-3xl font-bold text-ink">{administrators}</div><div className="mt-1 text-xs text-blue-700">Con acceso total</div></div>
        <div className="rounded-[24px] border border-amber-100 bg-amber-50/70 p-5"><div className="text-sm text-slate-600">Cajeros</div><div className="mt-2 text-3xl font-bold text-ink">{cashiers}</div><div className="mt-1 text-xs text-amber-700">En operación</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <h3 className="text-2xl font-bold text-ink">Listado de usuarios</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr),150px,150px]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o usuario..." />
            <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Todos los roles</option><option value="admin">Administrador</option><option value="cashier">Cajero</option></Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></Select>
          </div>
          <div className="soft-scrollbar mt-5 max-h-[calc(100vh-26rem)] space-y-3 overflow-auto pr-1">
            {visibleUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => editUser(user)}
                className={`w-full rounded-[24px] p-4 text-left transition ${form.id === user.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{user.name}</div>
                    <div className={`mt-1 text-xs ${form.id === user.id ? 'text-white/75' : 'text-slate-500'}`}>
                      @{user.username} | {user.branch_name || 'Sin sucursal'}
                    </div>
                    <div className={`mt-2 text-xs ${form.id === user.id ? 'text-white/72' : 'text-slate-500'}`}>
                      Recuperacion: {Number(user.has_security_question) === 1 ? 'Configurada' : 'Pendiente'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold uppercase">{user.role}</div>
                    <div className={`mt-1 text-xs ${form.id === user.id ? 'text-white/75' : Number(user.active) === 1 ? 'text-emerald-600' : 'text-rosewood'}`}>
                      {Number(user.active) === 1 ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {!visibleUsers.length ? <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">No se encontraron usuarios con ese criterio.</div> : null}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {form.id ? 'Editar usuario' : 'Nuevo usuario'}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-ink">
                {selectedUser ? selectedUser.name : 'Crear cuenta interna'}
              </h3>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Rol actual</div>
              <div className="mt-2 text-lg font-bold uppercase text-ink">{form.role}</div>
            </div>
          </div>

          <form onSubmit={saveUser} className="mt-6 grid gap-4">
            <Field label="Nombre completo">
              <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Usuario">
                <Input
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  disabled={Boolean(form.id)}
                />
              </Field>
              <Field label="Rol">
                <Select value={form.role} onChange={(event) => {
                  const nextRole = event.target.value;
                  setForm((current) => ({
                    ...current,
                    role: nextRole,
                    permissions: nextRole === 'admin' ? '*' : getDefaultPermissions('cashier')
                  }));
                }}>
                  <option value="cashier">Cajero</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Field label="Sucursal">
                <Select value={form.branchId} onChange={(event) => updateField('branchId', event.target.value)}>
                  <option value="">Sin sucursal fija</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label={form.id ? 'Nueva contrasena' : 'Contrasena'}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder={form.id ? 'Dejar vacio para no cambiar' : ''}
                />
              </Field>
            </div>

            <div className="grid gap-4">
              <Field label="Pregunta de seguridad" hint="Se usa para recuperar la contrasena localmente">
                <Select
                  value={form.securityQuestion}
                  onChange={(event) => updateField('securityQuestion', event.target.value)}
                >
                  <option value="">Seleccionar pregunta precargada</option>
                  {getSecurityQuestionOptions(form.securityQuestion).map((question) => (
                    <option key={question} value={question}>{question}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label={form.id ? 'Nueva respuesta de seguridad' : 'Respuesta de seguridad'}
                hint={form.id ? 'Dejala vacia si no quieres cambiar la respuesta actual' : ''}
              >
                <Input
                  type="password"
                  value={form.securityAnswer}
                  onChange={(event) => updateField('securityAnswer', event.target.value)}
                  placeholder={form.id ? 'Solo si deseas actualizarla' : 'Respuesta secreta'}
                />
              </Field>
            </div>

            <div className="border-t border-slate-200/80 pt-5">
              <div className="flex flex-col gap-1">
                <h4 className="text-xl font-bold text-ink">Permisos del usuario</h4>
                <p className="text-sm text-slate-600">Selecciona los módulos y acciones a los que tendrá acceso.</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.key} className="rounded-2xl border border-slate-200/80 bg-white/78 p-4">
                    <div className="flex items-center gap-2 font-bold text-ink">
                      <span className="text-emerald-700"><PermissionIcon name={group.icon} /></span>
                      {group.label}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {group.permissions.map((permission) => (
                        <label key={`${permission.module}:${permission.action}`} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={isPermissionChecked(permission.module, permission.action)}
                            disabled={form.role === 'admin'}
                            onChange={() => togglePermission(permission.module, permission.action)}
                          />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {form.role === 'admin' ? <div className="mt-3 text-xs text-slate-500">Los administradores conservan acceso total a todos los módulos.</div> : null}
            </div>

            {form.id ? (
              <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => updateField('active', event.target.checked)}
                />
                Usuario activo
              </label>
            ) : null}

            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : form.id ? 'Actualizar usuario' : 'Crear usuario'}
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
