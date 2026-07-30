'use client';
import { useState } from 'react';
import { residentFetch } from '../../lib/resident';

export default function ResidentChangePasswordPage(){
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function save(){
    try{
      const json=await residentFetch('/api/resident/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword,confirmPassword})});
      setMessage(json.message||'Password updated'); setError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }catch(e:any){ setError(e.message); setMessage(''); }
  }
  return <div className="residentPageShell">
    <section className="residentCard residentPasswordCard">
      <div><span className="residentEyebrow">Account security</span><h1>Change Password</h1><p>Use a strong password to keep your resident account secure.</p></div>
      {error?<div className="alert error">{error}</div>:null}{message?<div className="alert success">{message}</div>:null}
      <div className="residentPasswordGrid">
        <label className="field"><span className="lbl">Current Password</span><input type="password" className="inp" placeholder="Enter current password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} /></label>
        <label className="field"><span className="lbl">New Password</span><input type="password" className="inp" placeholder="Enter new password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} /></label>
        <label className="field"><span className="lbl">Confirm Password</span><input type="password" className="inp" placeholder="Confirm new password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} /></label>
      </div>
      <button className="btn primary residentActionBtn" onClick={save}>Update Password</button>
    </section>
  </div>;
}
