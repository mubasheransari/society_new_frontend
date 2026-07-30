'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { API_BASE, saveResidentSession } from '../../lib/resident';

export default function ResidentLoginPage() {
  const router = useRouter();
  const [plotNo, setPlotNo] = useState('');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(e?: FormEvent) {
    e?.preventDefault(); setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/resident/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ plotNo, password }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Login failed');
      saveResidentSession(json.token, { id: json.resident.id, fullName: json.resident.fullName, plotNo: json.resident.plotNo });
      router.push('/resident/dashboard');
    } catch (e:any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <main className="authPage residentAuthPage">
      <section className="authShowcase residentAuthShowcase">
        <div className="authBrand"><span className="authLogoMark authLogoImgMark"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" /></span><span>Resident Panel</span></div>
        <div className="authShowcaseContent">
          <span className="authEyebrow">Your society, one tap away</span>
          <h1>Stay connected to your home and community.</h1>
          <p>View dues and payments, read society announcements, submit complaints and request NOCs securely.</p>
          <div className="residentAuthStats"><div><strong>24/7</strong><span>Portal access</span></div><div><strong>100%</strong><span>Secure account</span></div></div>
        </div>
        <div className="authGlow authGlowOne"/><div className="authGlow authGlowTwo"/>
      </section>
      <section className="authFormSide">
        <form className="authCard" onSubmit={login}>
          <div className="authMobileBrand"><span className="authLogoMark authLogoImgMark"><img src="/logo.png" alt="Lucknow Co-operative Housing Society" /></span> Resident Panel</div>
          <span className="authEyebrow">Resident access</span>
          <h2>Welcome home</h2>
          <p className="authLead">Enter your plot number and password to open your account.</p>
          {error?<div className="alert error">{error}</div>:null}
          <label className="authField"><span>Plot number</span><div className="authInputWrap"><span>⌂</span><input value={plotNo} onChange={(e)=>setPlotNo(e.target.value)} placeholder="e.g. 309" autoComplete="username" /></div></label>
          <label className="authField"><span>Password</span><div className="authInputWrap"><span>⌁</span><input type={showPassword?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'Hide':'Show'}</button></div></label>
          <button className="authSubmit" disabled={loading}>{loading ? 'Signing in…' : 'Open resident dashboard'} <span>→</span></button>
          <div className="authHint"><b>First login?</b> The default password is <strong>123456</strong>. Change it after signing in.</div>
          <a className="authSwitch" href="/login">Administrator? Open admin login</a>
        </form>
      </section>
    </main>
  );
}
