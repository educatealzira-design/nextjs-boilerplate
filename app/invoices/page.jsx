"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../send/send.module.css"; // reutiliza el mismo CSS de Enviar horario

function fmtMoney(n){ return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n ?? 0); }
function fmtMonthHuman(ym){ const [y,m]=ym.split("-").map(Number); const d=new Date(Date.UTC(y,(m-1),1)); return d.toLocaleDateString("es-ES",{ month:"long", year:"numeric", timeZone:"UTC" }); }

export default function InvoicesSendPage(){
  const [month, setMonth] = useState(()=>{
    const now = new Date(); const y=now.getFullYear(); const m=String(now.getMonth()+1).padStart(2,"0"); return `${y}-${m}`;
  });
  const [items, setItems] = useState([]); // {invoiceId, studentId, fullName, phone, amount, status}

  // Tarjetas marcadas como “hecho” (copiado o abierto chat)
  const [doneIds, setDoneIds] = useState(new Set());
  const markDone = (id) => setDoneIds(prev => { const next = new Set(prev); next.add(id); return next; });

  async function load(){
    const [students, lessons, invoices] = await Promise.all([
      fetch("/api/students").then(r=>r.json()),
      fetch("/api/lessons").then(r=>r.json()),
      fetch(`/api/invoices?month=${month}`).then(r=>r.json())
    ]);

    // Agrupa lecciones por alumno y franja para estimar totalMin si no hay invoice
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

  // Igual que "Enviar horario": grid de TODAS las tarjetas (ocultamos las que no tienen teléfono)
  const filtered = useMemo(()=> items, [items]);

  function message(it){
    return `Hola ${it.fullName}, la mensualidad de este mes son ${fmtMoney(it.amount)}.\nMuchas gracias.`;
  }

  async function setStatus(it, newStatus){
    if (it.invoiceId){
      const r = await fetch(`/api/invoices/${it.invoiceId}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status: newStatus })
      });
      if (r.ok){
        setItems(prev=> prev.map(x=> x.studentId===it.studentId ? { ...x, status: newStatus } : x));
      }
    } else {
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
        const data = await created.json();
        const rec = Array.isArray(data) ? data[0] : data;
        setItems(prev=> prev.map(x=> x.studentId===it.studentId ? { ...x, status: newStatus, invoiceId: rec?.id ?? x.invoiceId } : x));
      }
    }
  }

  return (
    <div className={styles.layout}>
      {/* === CABECERA: logo a la izquierda, botones a la derecha (igual que Enviar horario) === */}
      <div className={styles.header}>
        <div className={styles.title}>
          <img src="/logo.png" alt="Edúcate" style={{ height:'70px', width:'auto'}}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <Link href="/receipts" className={styles.btnOutline}>← Recibos</Link>
          <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
            Abrir WhatsApp Web
          </a>
          <Link href="/" className={styles.btnPrimary}>Horario</Link>
          <div className={styles.weekBadge}>Mes: {fmtMonthHuman(month)}</div>
        </div>
      </div>

      {/* === CONTENIDO A PANTALLA COMPLETA: grid de tarjetas (idéntico patrón) === */}
      <div className={styles.board}>
        <div className={styles.cardsGrid}>
          {filtered.map(it=>{
            const phone = (it.phone || '').replace(/\D/g,'');
            const waLink = phone ? `https://wa.me/34${phone}?text=${encodeURIComponent(message(it))}` : null;
            const isDone = doneIds.has(it.studentId);

            const onCopy = async () => {
              try {
                await navigator.clipboard.writeText(message(it));
                await setStatus(it, "ENVIADO");
                markDone(it.studentId);
              } catch {
                alert('No se pudo copiar');
              }
            };

            const onOpenChat = async () => {
              await setStatus(it, "ENVIADO");
              markDone(it.studentId);
            };

            return (
              <div key={it.studentId} className={`${styles.card} ${isDone ? styles.cardDone : ''}`}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontWeight:600 }}>{it.fullName}</div>
                  {isDone && <span className={styles.donePill}>Hecho</span>}
                </div>

                <div style={{ fontSize:12, opacity:.7, marginBottom:10 }}>
                  {it.phone ? `📱 ${it.phone}` : '— sin teléfono —'} · {fmtMoney(it.amount)}
                </div>

                <textarea value={message(it)} readOnly rows={4} className={styles.msgBox} />

                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button onClick={onCopy} className={styles.btnOutline}>Copiar</button>

                  {waLink ? (
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary} onClick={onOpenChat}>
                      WhatsApp
                    </a>
                  ) : (
                    <span style={{ fontSize:12, opacity:.7 }}>Sin teléfono</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
