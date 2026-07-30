'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../lib/resident';
import { normalizeCurrentUser, saveAdminSession, type CurrentUser } from '../lib/access';


export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@invoice.com');
  const [password, setPassword] = useState('Admin@12345');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Login failed');
      saveAdminSession(json.token, normalizeCurrentUser(json.user as CurrentUser));
      router.push('/');
    } catch (err: any) { setError(err?.message || 'Login failed'); }
    finally { setBusy(false); }
  }

  return (
    <main className="authPage adminAuthPage">
      <section className="authShowcase">
        <div className="authBrand"><span className="authLogoMark authLogoImgMark"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" /></span><span>Lucknow Society</span></div>
        <div className="authShowcaseContent">
          <span className="authEyebrow">Society management platform</span>
          <h1>Manage your community with clarity.</h1>
          <p>Invoices, residents, portions, NOCs, complaints and announcements—all from one secure workspace.</p>
          <div className="authFeatureGrid">
            <div><b>01</b><span>Monthly billing</span></div>
            <div><b>02</b><span>Resident records</span></div>
            <div><b>03</b><span>NOC management</span></div>
            <div><b>04</b><span>Live updates</span></div>
          </div>
        </div>
        <div className="authGlow authGlowOne"/><div className="authGlow authGlowTwo"/>
      </section>
      <section className="authFormSide">
        <form className="authCard" onSubmit={submit}>
          <div className="authMobileBrand"><span className="authLogoMark authLogoImgMark"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" /></span> Lucknow Society</div>
          <span className="authEyebrow">Admin portal</span>
          <h2>Welcome back</h2>
          <p className="authLead">Sign in as super admin or sub admin to continue.</p>
          {error ? <div className="alert error">{error}</div> : null}
          <label className="authField"><span>Email address</span><div className="authInputWrap"><span>✉</span><input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" /></div></label>
          <label className="authField"><span>Password</span><div className="authInputWrap"><span>⌁</span><input type={showPassword?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div></label>
          <button className="authSubmit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to dashboard'} <span>→</span></button>
          <div className="authSecurity">🔒 Your session is protected and securely stored.</div>
          <a className="authSwitch" href="/resident/login">Resident? Open resident login</a>
        </form>
      </section>
    </main>
  );
}
