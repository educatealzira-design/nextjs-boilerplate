"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./receipts.module.css";

const DOW_LABEL = {1:"Lunes",2:"Martes",3:"Miércoles",4:"Jueves",5:"Viernes",6:"Sábado",7:"Domingo"};
const STATUSES = ["PENDIENTE","ENVIADO","PAGADO"];

function toHHMM(mins){ const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function fmtMoney(n){ return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(n ?? 0); }
function fmtMonthHuman(ym){ const [y,m]=ym.split("-").map(Number); const d=new Date(Date.UTC(y,(m-1),1)); return d.toLocaleDateString("es-ES",{month:"long",year:"numeric", timeZone:"UTC"}); }

// Mensaje de cobro para copiar
function buildChargeMessage(row){
  return `Hola ${row.student.fullName}, la mensualidad de este mes son ${fmtMoney(row.amount)}.\nMuchas gracias.`;
}

function datesOfMonthForDOW(ym, dow) {
  const [y,m]=ym.split("-").map(Number);
  const out=[]; const d=new Date(Date.UTC(y,(m-1),1));
  while(true){ const wd = d.getUTCDay()===0?7:d.getUTCDay(); if (wd===dow) break; d.setUTCDate(d.getUTCDate()+1); if (d.getUTCMonth()!==(m-1)) return out; }
  for(let cur=new Date(d); cur.getUTCMonth()===(m-1); cur.setUTCDate(cur.getUTCDate()+7)){ out.push(new Date(cur)); }
  return out;
}

function waLink(phone, text){ if(!phone) return null; return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }

function normalize(s){ return String(s||'').toLowerCase().trim(); }

/**
 * TARIFAS ESTÁNDAR
 * - PRIMARIA: 7 €/h
 * - 1–2 ESO: 8 €/h
 * - 3–4 ESO: 9 €/h
 * - BACHILLER: 12 €/h
 * - CICLOS/FP/GM/GS: 9 €/h
 */
function defaultRateForCourse(courseText){
  const c = normalize(courseText);

  // PRIMARIA (1º..6º)
  if (/\bprim(?:aria)?\b/.test(c)) return 7;

  // ESO: detecta 1..4 ESO
  const eso = c.match(/(\d)\s*º?\s*eso/);
  if (eso) {
    const n = Number(eso[1]);
    if (n === 1 || n === 2) return 8;   // 1-2 ESO
    if (n === 3 || n === 4) return 9;   // 3-4 ESO
  }

  // BACHILLER (1º o 2º)
  if (/\b(1|2)\s*º?\s*(bach|bachiller|bachillerato)\b/.test(c) || /\bbach(iller|illerato)?\b/.test(c)) {
    return 12;
  }

  // CICLOS / FP / GM / GS
  if (/\b(fp|ciclo|ciclos|grado medio|grado superior|formativo)\b/.test(c)) return 9;

  // No reconocido
  return 0;
}

export default function ReceiptsPage(){
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [invoices, setInvoices] = useState([]); // registros guardados
  const [month, setMonth] = useState(()=>{
    const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,"0"); return `${y}-${m}`;
  });
  const [q, setQ] = useState("");
  const [onlyWithLessons, setOnlyWithLessons] = useState(true);

  // estados editables en UI (reflejan invoices si existen)
  const [rates, setRates] = useState({});
  const [adjustMin, setAdjustMin] = useState({});
  const [status, setStatus] = useState({});    // PENDIENTE / ENVIADO / PAGADO
  const debounceTimer = useRef(null);

  // cargar datos base
  useEffect(()=>{
    Promise.all([
      fetch("/api/students").then(r=>r.json()),
      fetch("/api/lessons").then(r=>r.json()),
      fetch(`/api/invoices?month=${month}`).then(r=>r.json())
    ]).then(([s,l,inv])=>{
      setStudents(s); setLessons(l); setInvoices(Array.isArray(inv)?inv:[]);
      // hidratar UI desde invoices o desde datos por defecto
      const r={}, a={}, st={};
      for(const it of inv){
        const stFromList = s.find(x=>x.id===it.studentId);
        const byCourse = defaultRateForCourse(stFromList?.course);
        const fromDb   = typeof stFromList?.billingRateEurHour === "number" ? stFromList.billingRateEurHour : undefined;

        // Prioridad: valor en invoice > BD > tarifa por curso
        r[it.studentId]  = typeof it.rate==='number' ? it.rate : (fromDb ?? byCourse);
        a[it.studentId]  = it.adjustMin ?? 0;
        st[it.studentId] = it.status || "PENDIENTE";
      }
      // fallback para alumnos sin invoice previa
      for(const stn of s){
        const byCourse = defaultRateForCourse(stn.course);
        const fromDb   = typeof stn.billingRateEurHour === "number" ? stn.billingRateEurHour : undefined;

        if (r[stn.id]==null) r[stn.id] = fromDb ?? byCourse; // aplica tarifa estándar si no hay BD
        if (a[stn.id]==null) a[stn.id]=0;
        if (!st[stn.id]) st[stn.id]="PENDIENTE";
      }
      setRates(r); setAdjustMin(a); setStatus(st);
    }).catch((e)=>{
      console.error("Error cargando datos", e);
      setInvoices([]); // evitar crashear si la ruta falla
    });
  }, [month]);

  // construir filas con horas × nº días del mes
  const rows = useMemo(()=>{
    const byStudent = new Map();
    for(const ls of lessons){
      const keyS = ls.studentId;
      const keyL = `${ls.dayOfWeek}-${ls.startMin}`;
      if(!byStudent.has(keyS)) byStudent.set(keyS, new Map());
      const m = byStudent.get(keyS);
      if(!m.has(keyL)) m.set(keyL, { dow: ls.dayOfWeek, startMin: (ls.actualStartMin??ls.startMin), durMin: (ls.actualDurMin??ls.durMin) });
    }

    const out=[];
    for(const st of students){
      const m = byStudent.get(st.id);
      let items=[], total=0;
      if (m){
        for(const it of m.values()){
          const dates = datesOfMonthForDOW(month, it.dow);
          const count = dates.length;
          const minutes = it.durMin * count;
          items.push({ dow: it.dow, startMin: it.startMin, durMin: it.durMin, count, dates });
          total += minutes;
        }
      }
      items.sort((a,b)=> a.dow-b.dow || a.startMin-b.startMin);
      const adj = adjustMin[st.id] ?? 0;
      const totalMin = total + adj;

      // >>> TARIFA: manual (rates) > BD > estándar por curso
      const fallbackCourseRate = defaultRateForCourse(st.course);
      const rate = (rates[st.id] ?? st.billingRateEurHour ?? fallbackCourseRate ?? 0);

      const amount = rate * (totalMin/60);
      const inv = invoices.find(i=>i.studentId===st.id);
      const invId = inv?.id || null;
      const stStatus = status[st.id] || inv?.status || "PENDIENTE";
      out.push({ student:st, invoiceId:invId, items, totalMinPlan: total, totalMin, rate, amount, stStatus });
    }

    const t = q.toLowerCase();
    const filtered = out.filter(r=>{
      if (onlyWithLessons && r.items.length===0 && (r.totalMinPlan===0)) return false;
      return r.student.fullName.toLowerCase().includes(t) || String(r.student.course||"").toLowerCase().includes(t);
    });
    filtered.sort((a,b)=> a.student.fullName.localeCompare(b.student.fullName, "es"));
    return filtered;
  }, [students, lessons, invoices, month, q, onlyWithLessons, rates, adjustMin, status]);

  const totals = useMemo(()=>{
    const min = rows.reduce((acc,r)=> acc + r.totalMin, 0);
    const eur = rows.reduce((acc,r)=> acc + r.amount, 0);
    return { min, eur };
  }, [rows]);

  // persistencia (debounce 300 ms)
  function queueSave(row){
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async ()=>{
      const payload = {
        studentId: row.student.id,
        yearMonth: month,
        rate: row.rate,
        adjustMin: adjustMin[row.student.id] ?? 0,
        totalMin: row.totalMin,
        amount: row.amount,
        status: status[row.student.id] || "PENDIENTE"
      };
      const res = await fetch('/api/invoices', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (res.ok){
        const data = await res.json(); // upsert devuelve 1 elemento o lista
        const arr = Array.isArray(data) ? data : [data];
        setInvoices(prev=>{
          const map = new Map(prev.map(x=>[x.id,x]));
          for(const it of arr) map.set(it.id, it);
          return Array.from(map.values());
        });
      }
    }, 300);
  }

  // PDF minimal (solo si PAGADO)
  async function makePaidPdf(row, month){
    const [{ default: jsPDF }] = await Promise.all([ import("jspdf") ]);
    const doc = new jsPDF({ unit:"pt", format:"a4" });
    const margin = 72; let y = margin;

    const add = (t, size=16, bold=false, gap=12)=>{
        doc.setFont("helvetica", bold?"bold":"normal");
        doc.setFontSize(size);
        doc.text(t, margin, y);
        y += size + gap;
    };

    add("RECIBO EDÚCATE", 20, true, 20);
    add(`Alumno: ${row.student.fullName}`, 12, false, 8);
    add(`Mensualidad ${fmtMonthHuman(month)}: ${fmtMoney(row.amount)}`, 14, true, 24);
    add("PAGADO, muchas gracias.", 16, true, 0);

    return doc.output("blob");
  }

  async function downloadPaidPdf(row, month, currentStatus){
    if (currentStatus !== "PAGADO") {
        alert("Sólo disponible cuando el estado es PAGADO.");
        return;
    }
    const blob = await makePaidPdf(row, month);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Recibo-Pagado-${row.student.fullName.replace(/\s+/g,"_")}-${month}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function openWhatsappCharge(row){
    const txt = `Hola ${row.student.fullName}, la mensualidad de este mes son ${fmtMoney(row.amount)}.\nMuchas gracias.`;
    const link = waLink(row.student.phone, txt);
    if (!link) { alert("Este alumno no tiene teléfono"); return; }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  // handlers UI
  async function onChangeRate(studentId, val){
    const num = Number(val);
    setRates(prev=>({ ...prev, [studentId]: num }));
    const row = rows.find(r=>r.student.id===studentId); if (row) queueSave({ ...row, rate: num });
    if (row) queueSave({ ...row, rate: num });

    // ← Guarda en BD
    try {
      await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingRateEurHour: num }),
      });
    } catch (e) {
      console.error("No se pudo guardar la tarifa en BD", e);
    }
  }

  function onChangeAdj(studentId, val){
    const num = Number(val);
    setAdjustMin(prev=>({ ...prev, [studentId]: num }));
    const row = rows.find(r=>r.student.id===studentId);
    if (row){
      const newTotal = row.totalMinPlan + num;
      const newAmount = row.rate * (newTotal/60);
      queueSave({ ...row, totalMin: newTotal, amount: newAmount });
    }
  }
  function onChangeStatus(studentId, val){
    setStatus(prev=>({ ...prev, [studentId]: val }));
    const row = rows.find(r=>r.student.id===studentId);
    if (row) queueSave({ ...row, stStatus: val });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Recibos mensuales</h1>
          <div className={styles.row}>
            <Link href="/" className={styles.btnOutline}>← Volver al horario</Link>
            <Link href="/send" className={styles.btnOutline}>WhatsApp (horarios)</Link>
            <Link href="/invoices" className={styles.btnPrimary}>WhatsApp (cobros)</Link>
          </div>
        </div>
        <div className={styles.actions}>
          <label className={styles.label}>Mes</label>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className={styles.input}/>
          <input placeholder="Buscar nombre o curso..." value={q} onChange={e=>setQ(e.target.value)} className={styles.input} />
          <label className={styles.chk}><input type="checkbox" checked={onlyWithLessons} onChange={e=>setOnlyWithLessons(e.target.checked)} /> Sólo con clases</label>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th className={styles.right}>Clases</th>
              <th className={styles.right}>Min</th>
              <th className={styles.right}>Horas</th>
              <th className={styles.right}>Tarifa (€/h)</th>
              <th className={styles.right}>Ajuste (min)</th>
              <th className={styles.right}>Importe</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>{
              const classesCount = r.items.reduce((acc,it)=> acc + it.count, 0);
              return (
                <tr key={r.student.id}>
                  <td>
                    <div className={styles.name}>{r.student.fullName}</div>
                    {/* desglose opcional */}
                    {r.items.length>0 && (
                      <details className={styles.details}>
                        <summary>Ver desglose</summary>
                        <ul className={styles.ul}>
                          {r.items.map((it, idx)=> (
                            <li key={idx}>
                              <strong>{DOW_LABEL[it.dow]}</strong> · {toHHMM(it.startMin)} · {it.durMin}m × {it.count}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>{r.student.course}</td>
                  <td className={styles.right}>{classesCount}</td>
                  <td className={styles.right}>{r.totalMin}</td>
                  <td className={styles.right}>{(r.totalMin/60).toFixed(2)}</td>
                  <td className={styles.right}>
                    <input type="number" min={0} step={1} className={styles.inputNum}
                      value={r.rate}
                      onChange={e=> onChangeRate(r.student.id, e.target.value) }
                    />
                  </td>
                  <td className={styles.right}>
                    <input type="number" step={15} className={styles.inputNum}
                      value={adjustMin[r.student.id]??0}
                      onChange={e=> onChangeAdj(r.student.id, e.target.value) }
                    />
                  </td>
                  <td className={styles.right}>{fmtMoney(r.amount)}</td>
                  <td>
                    <select className={styles.select}
                      value={status[r.student.id] || r.stStatus || "PENDIENTE"}
                      onChange={e=> onChangeStatus(r.student.id, e.target.value)}
                    >
                      {STATUSES.map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className={styles.rowButtons}>
                        <button
                        className={styles.btn}
                        onClick={async ()=>{
                            try {
                            await navigator.clipboard.writeText(buildChargeMessage(r));
                            // Marca como ENVIADO y persiste (usa tu onChangeStatus -> queueSave)
                            onChangeStatus(r.student.id, "ENVIADO");
                            alert("Mensaje copiado y marcado como ENVIADO");
                            } catch {
                            alert("No se pudo copiar");
                            }
                        }}
                        >
                        Copiar
                        </button>

                        <button
                        className={styles.btn}
                        onClick={()=> {
                            const current = (status[r.student.id] || r.stStatus || "PENDIENTE");
                            downloadPaidPdf(r, month, current);
                        }}
                        >
                        PDF (Pagado)
                        </button>
                    </div>
                </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>Totales</strong></td>
              <td className={styles.right}><strong>{totals.min}</strong></td>
              <td className={styles.right}><strong>{(totals.min/60).toFixed(2)}</strong></td>
              <td></td><td></td>
              <td className={styles.right}><strong>{fmtMoney(totals.eur)}</strong></td>
              <td></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
