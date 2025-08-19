"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../send/send.module.css"; // reutilizamos estilos
const STATUSES = ["PENDIENTE","ENVIADO","PAGADO"];

function fmtMoney(n){ return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n); }
function waLink(phone, text){ if (!phone) return null; return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }
function fmtMonthHuman(ym){ const [y,m]=ym.split("-").map(Number); const d=new Date(Date.UTC(y,(m-1),1)); return d.toLocaleDateString("es-ES",{ month:"long", year:"numeric", timeZone:"UTC" }); }

export default function InvoicesSendPage(){
  const [month, setMonth] = useState(()=>{
    const now = new Date(); const y=now.getFullYear(); const m=String(now.getMonth()+1).padStart(2,"0"); return `${y}-${m}`;
  });
  const [items, setItems] = useState([]); // {invoiceId, studentId, fullName, phone, amount, status}
  const [q, setQ] = useState("");
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);

  async function load(){
    const [students, lessons, invoices] = await Promise.all([
      fetch("/api/students").then(r=>r.json()),
      fetch("/api/lessons").then(r=>r.json()),
      fetch(`/api/invoices?month=${month}`).then(r=>r.json())
    ]);

    // Calcula importe si no hay invoice aún (misma lógica que en recibos)
    const groups = new Map();
    for(const ls of lessons){
      const keyS = ls.studentId;
      const keyL = `${ls.dayOfWeek}-${ls.startMin}`;
      if(!groups.has(keyS)) groups.set(keyS, new Map());
      const m = groups.get(keyS);
      if(!m.has(keyL)) m.set(keyL, { dow: ls.dayOfWeek, durMin: (ls.actualDurMin??ls.durMin) });
    }

    const makeTotalMin = (studentId)=>{
      const m = groups.get(studentId); if(!m) return 0;
      const [y,mm] = month.split("-").map(Number);
      let total=0;
      for(const it of m.values()){
        // contar cuántos días de ese dow hay en el mes:
        const d=new Date(Date.UTC(y,(mm-1),1));
        let cnt=0;
        while(d.getUTCMonth()===(mm-1)){
          const wd = d.getUTCDay()===0?7:d.getUTCDay();
          if (wd===it.dow) cnt++;
          d.setUTCDate(d.getUTCDate()+1);
        }
        total += it.durMin * cnt;
      }
      return total;
    };

    const rows = students.map(st=>{
      const inv = (Array.isArray(invoices)?invoices:[]).find(x=>x.studentId===st.id);
      const rate = inv?.rate ?? st.billingRateEurHour ?? 0;
      const totalMin = inv?.totalMin ?? makeTotalMin(st.id) + (inv?.adjustMin ?? 0);
      const amount = inv?.amount ?? (rate * (totalMin/60));
      return {
        invoiceId: inv?.id || null,
        studentId: st.id,
        fullName: st.fullName,
        phone: st.phone,
        amount,
        status: inv?.status || "PENDIENTE"
      };
    });

    setItems(rows);
  }

  useEffect(()=>{ load(); }, [month]);

  const filtered = useMemo(()=>{
    const t = q.toLowerCase();
    return items.filter(it=>{
      if (onlyWithPhone && !it.phone) return false;
      return (it.fullName||"").toLowerCase().includes(t);
    });
  }, [items, q, onlyWithPhone]);

  function message(it){
    return `Hola ${it.fullName}, la mensualidad de este mes son ${fmtMoney(it.amount)}.\nMuchas gracias.`;
  }

  async function setStatus(it, newStatus){
    // si existe invoice, PATCH; si no, creamos una mínima
    if (it.invoiceId){
      const r = await fetch(`/api/invoices/${it.invoiceId}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status: newStatus })
      });
      if (r.ok){
        setItems(prev=> prev.map(x=> x.studentId===it.studentId ? { ...x, status: newStatus } : x));
      }
    } else {
      // creación mínima con estado
      const created = await fetch('/api/invoices', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          studentId: it.studentId,
          yearMonth: month,
          rate: 0,
          adjustMin: 0,
          totalMin: 0,
          amount: it.amount || 0,
          status: newStatus
        })
      });
      if (created.ok){
        const [rec] = await created.json();
        setItems(prev=> prev.map(x=> x.studentId===it.studentId ? { ...x, status: newStatus, invoiceId: rec.id } : x));
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WhatsApp (cobros)</h1>
          <p className={styles.subtitle}>Mensajes de cobro por alumno para {fmtMonthHuman(month)}.</p>
          <div className={styles.row}>
            <Link href="/receipts" className={styles.btnOutline}>← Recibos</Link>
            <Link href="/" className={styles.btnOutline}>Horario</Link>
            <a href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
              Abrir WhatsApp Web
            </a>
          </div>
        </div>
        <div className={styles.actions}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className={styles.input}/>
          <input className={styles.input} placeholder="Buscar alumno..." value={q} onChange={e=>setQ(e.target.value)} />
          <label className={styles.chk}>
            <input type="checkbox" checked={onlyWithPhone} onChange={e=>setOnlyWithPhone(e.target.checked)} />
            Sólo con teléfono
          </label>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.muted}>{filtered.length} mensajes listos</span>
      </div>

      <div className={styles.grid}>
        {filtered.map(it=>{
          const link = waLink(it.phone, message(it));
          return (
            <div key={it.studentId} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.name}>{it.fullName}</div>
                  <div className={styles.meta}>
                    {it.phone ? `📱 ${it.phone}` : '— sin teléfono —'} · {fmtMoney(it.amount)}
                  </div>
                </div>
                {link
                  ? <a href={link} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>Abrir chat</a>
                  : <button className={styles.btnDisabled} disabled>Sin teléfono</button>
                }
              </div>

              <div className={styles.preview}>{message(it)}</div>

              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <label>Estado:</label>
                <select
                  value={it.status}
                  onChange={e=> setStatus(it, e.target.value)}
                  className={styles.input}
                >
                  {STATUSES.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  className={styles.btnCopy}
                  onClick={async ()=>{
                    try { await navigator.clipboard.writeText(message(it)); alert('Copiado'); }
                    catch { alert('No se pudo copiar'); }
                  }}
                >Copiar texto</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
