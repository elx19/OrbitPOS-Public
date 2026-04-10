import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';
import securityQuestions from '../../../../shared/security-questions.json';

const emptyForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  role: 'cashier',
  branchId: '',
  active: true,
  securityQuestion: '',
  securityAnswer: ''
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
    securityAnswer: ''
  };
}

function getSecurityQuestionOptions(currentQuestion = '') {
  const trimmedCurrent = String(currentQuestion || '').trim();
  return trimmedCurrent && !securityQuestions.includes(trimmedCurrent)
    ? [trimmedCurrent, ...securityQuestions]
    : securityQuestions;
}

export default function UsersPanel({ token, onActivity }) {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedUser = users.find((user) => user.id === form.id) || null;
  const activeUsers = useMemo(
    () => users.filter((user) => Number(user.active) === 1).length,
    [users]
  );

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
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Usuarios del sistema</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Gestion de usuarios</h2>
            <p className="mt-3 text-sm text-slate-600">
              Controla accesos, roles, sucursales y recuperacion local de contrasena en una vista mas clara.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Usuarios</div>
              <div className="mt-2 text-2xl font-bold text-ink">{users.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Activos</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{activeUsers}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Seleccionado</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedUser?.name || 'Ninguno'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Directorio</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Listado de usuarios</h3>
          </div>
          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-21rem)] space-y-3 overflow-auto pr-1">
            {users.map((user) => (
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
                <Select value={form.role} onChange={(event) => updateField('role', event.target.value)}>
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
