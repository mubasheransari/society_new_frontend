'use client';
import { useEffect, useState } from 'react';
import { money, residentFetch } from '../../lib/resident';

export default function ResidentPaymentsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{residentFetch('/api/resident/payments').then((res)=>setItems(Array.isArray(res)?res:[])).catch((e)=>setError(e.message));},[]);
  const total = items.reduce((sum, item)=> sum + Number(item.amount_paid || 0), 0);
  return <div className="residentPageShell">
    <section className="residentCard residentPageIntro">
      <div><span className="residentEyebrow">Payment records</span><h1>Maintenance Payments</h1><p>Track all received maintenance payments and monthly billing history.</p></div>
      <div className="residentStatusCard compact"><span>Total Paid</span><strong>{money(total)}</strong><small>{items.length} transaction(s)</small></div>
    </section>
    {error?<div className="alert error">{error}</div>:null}
    <section className="residentCard">
      <div className="residentPaymentList">
        {items.map((i)=><article key={i.id} className="residentPaymentCard"><div className="residentPaymentIcon">₨</div><div><span>Bill Month</span><strong>{i.bill_month || '-'}</strong><small>{i.notes || 'Maintenance payment'}</small></div><div className="residentPaymentAmount"><strong>{money(i.amount_paid)}</strong><span>{i.payment_date ? new Date(i.payment_date).toLocaleString() : '-'}</span></div></article>)}
        {!items.length?<div className="residentEmpty">No payment records found.</div>:null}
      </div>
    </section>
  </div>;
}
