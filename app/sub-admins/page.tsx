'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_PERMISSIONS, getCurrentUser, normalizePermissions, saveCurrentUser, type NavKey } from '../lib/access';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const permissionLabels: Record<NavKey, string> = {
  dashboard: 'Dashboard',
  addHouse: 'Add New House',
  categoryCharges: 'Category Charges',
  records: 'Records',
  generateNoc: 'Generate NOC',
  settings: 'Settings',
  subAdmins: 'Sub Admins',
  posts: 'Society Posts',
  complaints: 'Complaints',
};

type AdminRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: Record<NavKey, boolean>;
  password?: string;
  passwordPlain?: string;
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  permissions: normalizePermissions(DEFAULT_PERMISSIONS),
};

export default function SubAdminsPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [visiblePasswordRows, setVisiblePasswordRows] = useState<Record<number, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currentUser = getCurrentUser();

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/admin-users`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load sub admins');
      setRows(Array.isArray(json) ? json.filter((x) => x.role !== 'super_admin') : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sub admins');
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormPassword(false);
    setShowConfirmPassword(false);
  }

  function startEdit(row: AdminRow) {
    setError('');
    setMessage('');
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      email: row.email || '',
      password: '',
      confirmPassword: '',
      permissions: normalizePermissions(row.permissions || {}),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    setError('');
    setMessage('');

    const isEditing = editingId !== null;
    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();

    if (!name) return setError('Name is required.');
    if (!email) return setError('Username / Email is required.');
    if (!isEditing && !password) return setError('Password is required.');
    if (password || confirmPassword) {
      if (!password) return setError('Password is required.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirmPassword) return setError('Password and confirm password must match.');
    }

    try {
      const payload: any = {
        name,
        email,
        role: 'sub_admin',
        permissions: form.permissions,
      };
      if (password) {
        payload.password = password;
        payload.confirmPassword = confirmPassword;
      }

      const res = await fetch(`${API_BASE}/api/admin-users${isEditing ? `/${editingId}` : ''}`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to save sub admin');

      setMessage(isEditing ? 'Sub admin updated successfully.' : 'Sub admin saved successfully.');
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save sub admin');
    }
  }

  async function toggleStatus(row: AdminRow) {
    const res = await fetch(`${API_BASE}/api/admin-users/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: row.name,
        email: row.email,
        isActive: !row.isActive,
        permissions: row.permissions,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json?.message || 'Failed to update status');
    await load();
  }

  async function remove(id: number) {
    const ok = window.confirm('Delete this sub admin?');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/api/admin-users/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json?.message || 'Failed to delete sub admin');
    if (editingId === id) resetForm();
    await load();
  }

  function useAsOperator(row: AdminRow) {
    saveCurrentUser({ name: row.name, email: row.email, role: 'sub_admin', permissions: normalizePermissions(row.permissions) });
    window.dispatchEvent(new Event('storage'));
    setMessage(`${row.name} is now the active operator on this browser.`);
  }

  function rowPassword(row: AdminRow) {
    return row.passwordPlain || row.password || '';
  }

  if (currentUser.role !== 'super_admin') {
    return <div className="wrap wideWrap"><div className="card wideCard"><div className="alert error">Only Super Admin can manage sub admins.</div></div></div>;
  }

  return (
    <div className="wrap wideWrap">
      <div className="pageGrid">
        <div className="card wideCard subAdminEditorCard">
          <div className="pageHead">
            <div>
              <h1 className="h1">{editingId ? 'Edit Sub Admin' : 'Sub Admins'}</h1>
              <p className="p">Create sub admins, update existing users, and control dashboard rights.</p>
            </div>
            {editingId && <button className="btn" onClick={resetForm}>Cancel Edit</button>}
          </div>
          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert error">{error}</div>}

          <div className="subAdminFormPanel fullWidthPanel">
            <div className="formGrid3">
              <div className="field">
                <label className="lbl">Name</label>
                <input className="inp" placeholder="Enter full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label className="lbl">Username / Email</label>
                <input className="inp" placeholder="Enter username or email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label className="lbl">Password {editingId && <span className="mutedText">(leave blank to keep same)</span>}</label>
                <div className="passwordInputWrap">
                  <input className="inp passwordInp" placeholder={editingId ? 'New password optional' : 'Enter password'} type={showFormPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" className="eyeBtn" onClick={() => setShowFormPassword((v) => !v)}>{showFormPassword ? '🙈' : '👁'}</button>
                </div>
              </div>
              <div className="field">
                <label className="lbl">Confirm Password</label>
                <div className="passwordInputWrap">
                  <input className="inp passwordInp" placeholder="Confirm password" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                  <button type="button" className="eyeBtn" onClick={() => setShowConfirmPassword((v) => !v)}>{showConfirmPassword ? '🙈' : '👁'}</button>
                </div>
              </div>
            </div>
          </div>

          <div className="permissionsHeader">Permissions / Rights</div>
          <div className="permissionsGrid modernPermissions">
            {(Object.keys(permissionLabels) as NavKey[]).map((key) => (
              <label key={key} className="permissionItem">
                <input type="checkbox" checked={!!form.permissions[key]} onChange={(e) => setForm({ ...form, permissions: { ...form.permissions, [key]: e.target.checked } })} />
                <span>{permissionLabels[key]}</span>
              </label>
            ))}
          </div>
          <div className="printActions">
            <button className="btn primary" onClick={save}>{editingId ? 'Update Sub Admin' : 'Save Sub Admin'}</button>
          </div>
        </div>

        <div className="card wideCard modernTableCard">
          <div className="sectionTitleRow">
            <div>
              <h2 className="h2">Existing Sub Admins</h2>
              <p className="p">View passwords, edit rights, activate or remove created sub-admin accounts.</p>
            </div>
          </div>
          <div className="tableWrap">
            <table className="tbl wideTbl subAdminTable">
              <thead><tr><th>Name</th><th>Username / Email</th><th>Password</th><th>Status</th><th>Rights</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const pass = rowPassword(row);
                  const visible = !!visiblePasswordRows[row.id];
                  return (
                    <tr key={row.id} className={editingId === row.id ? 'editingRow' : ''}>
                      <td>{row.name}</td>
                      <td>{row.email}</td>
                      <td>
                        <div className="tablePasswordCell">
                          <span>{pass ? (visible ? pass : '••••••••') : 'Not available'}</span>
                          <button type="button" className="iconMiniBtn" onClick={() => setVisiblePasswordRows((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}>{visible ? '🙈' : '👁'}</button>
                        </div>
                      </td>
                      <td><span className={`statusBadge ${row.isActive ? 'paid' : 'unpaid'}`}>{row.isActive ? 'Active' : 'Disabled'}</span></td>
                      <td className="rightsCell">{(Object.keys(permissionLabels) as NavKey[]).filter((key) => row.permissions?.[key]).map((k) => permissionLabels[k]).join(', ') || 'No rights'}</td>
                      <td className="actionCell">
                        <button className="btn small" onClick={() => startEdit(row)}>Edit</button>
                        <button className="btn small" onClick={() => useAsOperator(row)}>Use Here</button>
                        <button className="btn small" onClick={() => toggleStatus(row)}>{row.isActive ? 'Disable' : 'Enable'}</button>
                        <button className="btn small dangerBtn" onClick={() => remove(row.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={6} className="mutedCell">No sub admins created yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
