"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../send/send.module.css"; // reutiliza el mismo CSS de Enviar horario

function fmtMoney(n){ return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n ?? 0); }
function fmtMonthHuman(ym){ const [y,m]=ym.split("-").map(Number); const d=new Date(Date.UTC(y,(m-1),1)); return d.toLocaleDateString("es-ES",{ month:"long", year:"numeric", timeZone:"UTC" }); }

// --- helpers de tarifa por curso+horas ---
function firstPositive(/* ...vals */) {
  for (const v of arguments) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function computeWeeklyHoursFromLessons(studentId, lessons){
  // sumamos una semana tipo: cada franja única (DOW+start) cuenta una vez
  const uniq = new Map();
  for (const ls of lessons){
    if (ls.studentId !== studentId) continue;
    const key = `${ls.dayOfWeek}-${ls.startMin}`;
    if (!uniq.has(key)) {
      const dur = Number(ls.actualDurMin ?? ls.durMin) || 0;
      uniq.set(key, dur);
    }
  }
  const weeklyMin = Array.from(uniq.values()).reduce((a,b)=>a+b,0);
  return weeklyMin / 60;
}

function normalize(s){ return String(s||'').toLowerCase().trim(); }
function parseCourse(courseText){
  const c = normalize(courseText);
  if (/\bprim(?:aria)?\b/.test(c)) return 'PRIMARIA';
  const eso = c.match(/(\d)\s*º?\s*eso/);
  if (eso) { const n = Number(eso[1]); if (n===1) return 'ESO1'; if (n===2) return 'ESO2'; if (n===3) return 'ESO3'; if (n===4) return 'ESO4'; }
  if (/\b1\s*º?\s*(bach|bachiller|bachillerato)\b/.test(c)) return 'BACH1';
  if (/\b2\s*º?\s*(bach|bachiller|bachillerato)\b/.test(c)) return 'BACH2';
  if (/\b(fp|ciclo|ciclos|grado medio|grado superior|formativo)\b/.test(c)) return 'CICLO';
  return null;
}
const RATE_TABLE = {
  PRIMARIA: { 1: 7.5, 2: 6.25, 3: 5.83, 4: 5.63, 5: 5.25 },
  ESO1:     { 1: 8.00, 2: 7.13, 3: 6.25, 4: 5.94, 5: 5.50 },
  ESO2:     { 1: 8.00, 2: 7.13, 3: 6.67, 4: 5.94, 5: 5.50 },
  ESO3:     { 1: 8.00, 2: 7.50, 3: 7.00, 4: 6.88, 5: 6.25 },
  ESO4:     { 1: 8.00, 2: 7.50, 3: 7.00, 4: 6.88, 5: 6.25 },
  BACH1:    { 1: 8.00, 2: 8.00, 3: 7.50, 4: 7.19 },
  BACH2:    { 1: 8.00, 2: 8.00, 3: 7.50, 4: 7.19 },
};
function defaultRateForStudent(student, weeklyHoursHint){
  const cat = parseCourse(student?.course);
  if (!cat) return 0;
  if (cat === 'CICLO') return 7;
  const table = RATE_TABLE[cat];
  if (!table) return 0;

   // 👉 Prioridad: desiredHours > weekly* > hint > 1
  let wh = firstPositive(
    student?.desiredHours,
    student?.weeklyHours,
    student?.hoursPerWeek,
    student?.weekly_hours,
    student?.hours_week,
    weeklyHoursHint
  ) || 1;

  const hRounded = Math.round(wh);
  const defined = Object.keys(table).map(Number);
  const h = Math.min(Math.max(hRounded, Math.min(...defined)), Math.max(...defined));
  return table[h];
}

export default function InvoicesSendPage(){
  const [month, setMonth] = useState(()=>{
    const now = new Date(); const y=now.getFullYear(); const m=String(now.getMonth()+1).padStart(2,"0"); return `${y}-${m}`;
  });
  const [items, setItems] = useState([]); // {invoiceId, studentId, fullName, phone, amount, status}
  function setLocalStatus(studentId, newStatus) {
    setItems(prev =>
      prev.map(x => x.studentId === studentId ? { ...x, status: newStatus } : x)
    );
  }

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
      const weeklyHoursHint = computeWeeklyHoursFromLessons(st.id, lessons);
      const inv = (Array.isArray(invoices)?invoices:[]).find(x=>x.studentId===st.id);
      const rate = firstPositive(
        inv?.rate,
        defaultRateForStudent(st, weeklyHoursHint),
        st.billingRateEurHour
      );
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
    return `Hola ${it.fullName.split(' ')[0]}, la mensualidad de este mes son ${fmtMoney(it.amount)}.\nMuchas gracias.`;
  }

  async function setStatus(it, newStatus){
    if (it.invoiceId) {
      const r = await fetch(`/api/invoices/${it.invoiceId}`, {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status: newStatus })
      });

      // Si el PATCH falla (ruta no encontrada, etc.), hacemos upsert por (studentId, month)
      if (!r.ok) {
        const created = await fetch('/api/invoices', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
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
          const rec = await created.json();
          const inv = Array.isArray(rec) ? rec[0] : rec;
          setItems(prev => prev.map(x =>
            x.studentId === it.studentId
              ? { ...x, status: newStatus, invoiceId: inv?.id ?? x.invoiceId }
              : x
          ));
        }
        return;
      }

      // PATCH OK
      setItems(prev => prev.map(x =>
        x.studentId === it.studentId ? { ...x, status: newStatus } : x
      ));
    } else {
      // No había invoice todavía → creamos
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
        const rec = await created.json();
        const inv = Array.isArray(rec) ? rec[0] : rec;
        setItems(prev => prev.map(x =>
          x.studentId === it.studentId
            ? { ...x, status: newStatus, invoiceId: inv?.id ?? x.invoiceId }
            : x
        ));
      }
    }
  }

  async function undoDone(it){
    setLocalStatus(it.studentId, "PENDIENTE");
    await setStatus(it, "PENDIENTE");
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
            const isDone = it.status === "ENVIADO" || it.status === "PAGADO";
            const onCopy = async () => {
              try { await navigator.clipboard.writeText(message(it)); } catch {}
              // Pinta “Hecho” al instante
              setLocalStatus(it.studentId, "ENVIADO");
              // Persistimos en BD
              await setStatus(it, "ENVIADO");
            };

            const onOpenChat = async () => {
              setLocalStatus(it.studentId, "ENVIADO");
              await setStatus(it, "ENVIADO");
            };
            return (
              <div key={it.studentId} className={`${styles.card} ${isDone ? styles.cardDone : ''}`}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontWeight:600 }}>{it.fullName}</div>
                  {isDone && (
                    <span className={styles.donePill}>
                      Hecho
                      <button
                        type="button"
                        className={styles.doneClose}
                        aria-label="Desmarcar envío"
                        title="Desmarcar"
                        onClick={(e)=>{ e.preventDefault(); undoDone(it); }}
                      >
                        ×
                      </button>
                    </span>
                  )}
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
