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
 */
//helper: toma la primera tarifa > 0 y evita que 0 bloquee los fallback
function firstPositive(/* ...vals */) {
  for (const v of arguments) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
//si el alumno no tiene weeklyHours en BD, inferimos horas/semana a partir del horario
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
function parseCourse(courseText){
  const c = normalize(courseText);
  if (/\bprim(?:aria)?\b/.test(c)) return 'PRIMARIA';

  const eso = c.match(/(\d)\s*º?\s*eso/);
  if (eso) {
    const n = Number(eso[1]);
    if (n===1) return 'ESO1';
    if (n===2) return 'ESO2';
    if (n===3) return 'ESO3';
    if (n===4) return 'ESO4';
  }

  if (/\b1\s*º?\s*(bach|bachiller|bachillerato)\b/.test(c)) return 'BACH1';
  if (/\b2\s*º?\s*(bach|bachiller|bachillerato)\b/.test(c)) return 'BACH2';

  if (/\b(fp|ciclo|ciclos|grado medio|grado superior|formativo)\b/.test(c)) return 'CICLO';
  return null;
}

// Tablas por horas/semana (redondeamos horas al entero más cercano)
const RATE_TABLE = {
  PRIMARIA: { 1: 7.5, 2: 6.25, 3: 5.83, 4: 5.63, 5: 5.25 },
  ESO1:     { 1: 8.00, 2: 7.13, 3: 6.25, 4: 5.94, 5: 5.50 },
  ESO2:     { 1: 8.00, 2: 7.13, 3: 6.67, 4: 5.94, 5: 5.50 },
  ESO3:     { 1: 8.00, 2: 7.50, 3: 7.00, 4: 6.88, 5: 6.25 },
  ESO4:     { 1: 8.00, 2: 7.50, 3: 7.00, 4: 6.88, 5: 6.25 },
  BACH1:    { 1: 8.00, 2: 8.00, 3: 7.50, 4: 7.19 },     // no hay 5h, se “clampa”
  BACH2:    { 1: 8.00, 2: 8.00, 3: 7.50, 4: 7.19 },     // no hay 5h, se “clampa”
  // CICLO: tarifa fija
};

function defaultRateForStudent(student, weeklyHoursHint){
  const cat = parseCourse(student?.course);
  if (!cat) return 0;
  if (cat === 'CICLO') return 7; // tarifa fija

  const table = RATE_TABLE[cat];
  if (!table) return 0;

  // usa weeklyHours de BD o, si no hay, el hint calculado desde lessons
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
  const [paymentMethod, setPaymentMethod] = useState({});
  const [adjustMin, setAdjustMin] = useState({});
  const [status, setStatus] = useState({});    // PENDIENTE / ENVIADO / PAGADO
  const debounceTimer = useRef(null);

  // cargar datos base
  useEffect(() => {
    Promise.all([
      fetch("/api/students").then(r => r.json()),
      fetch("/api/lessons").then(r => r.json()),
      fetch(`/api/invoices?month=${month}`).then(r => r.json())
    ])
    .then(([sRaw, lRaw, invRaw]) => {
      const sArr   = Array.isArray(sRaw)   ? sRaw   : (sRaw?.items ?? sRaw?.rows ?? []);
      const lArr   = Array.isArray(lRaw)   ? lRaw   : (lRaw?.items ?? lRaw?.rows ?? []);
      const invArr = Array.isArray(invRaw) ? invRaw : (invRaw?.items ?? invRaw?.rows ?? []);

      setStudents(sArr);
      setLessons(lArr);
      setInvoices(invArr);

      const r = {}, a = {}, st = {}, pm = {};
      for (const it of invArr) {
        const stFromList = sArr.find(x => x.id === it.studentId);
        const weeklyHoursHint = computeWeeklyHoursFromLessons(stFromList?.id, lArr);
        const byCourse = defaultRateForStudent(stFromList, weeklyHoursHint);
        const fromDb   = (typeof stFromList?.billingRateEurHour === "number")
          ? stFromList.billingRateEurHour
          : undefined;

        // Prioridad correcta: invoice > tarifa guardada en alumno > por curso+horas
        r[it.studentId]  = firstPositive(it.rate, fromDb, byCourse);
        a[it.studentId]  = it.adjustMin ?? 0;
        st[it.studentId] = it.status || "PENDIENTE";
        pm[it.studentId] = it.paymentMethod || "Transfer.";
      }

      // Fallback para los que no tienen invoice este mes
      for (const stn of sArr) {
        const weeklyHoursHint = computeWeeklyHoursFromLessons(stn.id, lArr);
        const byCourse = defaultRateForStudent(stn, weeklyHoursHint);
        const fromDb   = (typeof stn.billingRateEurHour === "number") ? stn.billingRateEurHour : undefined;

        if (r[stn.id] == null) r[stn.id] = firstPositive(fromDb, byCourse);
        if (a[stn.id] == null) a[stn.id] = 0;
        if (!st[stn.id]) st[stn.id] = "PENDIENTE";
        if (!pm[stn.id]) pm[stn.id] = "Transfer.";
      }

      setRates(r);
      setAdjustMin(a);
      setStatus(st);
      setPaymentMethod(pm);
    })
    .catch(e => {
      console.error("Error cargando datos", e);
      setStudents([]); setLessons([]); setInvoices([]);
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
      const weeklyHoursHint = (()=>{
        if (!m) return 0;
        // m ya tiene por alumno las franjas únicas de la semana
        const weeklyMin = Array.from(m.values()).reduce((acc, it)=> acc + (Number(it.durMin)||0), 0);
        return weeklyMin / 60;
      })();
      // >>> TARIFA: manual (rates) > BD > estándar por curso
      const fallbackCourseRate = defaultRateForStudent(st, weeklyHoursHint);
      const rate = firstPositive(rates[st.id], st.billingRateEurHour, fallbackCourseRate);
      const amount = rate * (totalMin/60);
      const inv = invoices.find(i=>i.studentId===st.id);
      const invId = inv?.id || null;
      const stStatus = status[st.id] || inv?.status || "PENDIENTE";
      const method = (paymentMethod[st.id] ?? inv?.paymentMethod ?? "Transfer.");
      out.push({ student:st, invoiceId:invId, items, totalMinPlan: total, totalMin, rate, amount, stStatus, method, });
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
        status: status[row.student.id] || "PENDIENTE",
        paymentMethod: paymentMethod[row.student.id] || "Transfer."
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

  // -------- RECIBO PDF minimal (solo si PAGADO) --------
  // Carga una imagen (logo) y la devuelve como DataURL; si falla, devuelve null
  async function loadImageAsDataURL(url){
    try{
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }catch{
      return null;
    }
  }

  async function makePaidPdf(row, month, opts = {}){
    const logoUrl = opts.logoUrl || "/logo.png";

    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit:"pt", format:"a4" });

    // Tokens de estilo
    const margin = 64;
    const primary = "#0f172a";   // slate-900
    const muted   = "#64748b";   // slate-500
    const border  = "#e5e7eb";   // gray-200
    const accent  = "#16a34a";   // green-600
    const soft    = "#f3f4f6";   // gray-100

    let y = margin;

    // Helpers de texto
    const T = {
      set(size, bold=false, color=primary){
        doc.setFont("helvetica", bold? "bold":"normal");
        doc.setFontSize(size);
        doc.setTextColor(color);
      },
      text(t, x, yy){ doc.text(t, x, yy); },
    };

    // Cabecera con logo y título
    const logoDataUrl = await loadImageAsDataURL(logoUrl);
    const headerH = 56;

    // banda superior
    doc.setFillColor(soft);
    doc.roundedRect(0, 0, doc.internal.pageSize.getWidth(), 24, 0, 0, "F");

    if (logoDataUrl){
      doc.addImage(logoDataUrl, "PNG", margin, y-8, 120, 40, undefined, "FAST");
    }

    T.set(22, true, primary);

    // badge del mes
    const monthLabel = `Mensualidad ${fmtMonthHuman(month)}`;
    const badgeW = doc.getTextWidth(monthLabel) + 18;
    doc.setFillColor("#eef2ff");
    doc.setDrawColor("#c7d2fe");
    doc.roundedRect(doc.internal.pageSize.getWidth() - margin - badgeW, y-16, badgeW, 28, 8, 8, "FD");
    T.set(12, true, "#3730a3");
    doc.text(monthLabel, doc.internal.pageSize.getWidth() - margin - badgeW + 9, y+4);

    y += headerH;

    // Caja importe pagado
    const amountStr = fmtMoney(row.amount);
    doc.setDrawColor(border);
    doc.setFillColor("#ecfdf5");
    doc.roundedRect(margin, y, doc.internal.pageSize.getWidth()-2*margin, 70, 12, 12, "FD");
    T.set(12, false, muted);
    doc.text("Importe pagado", margin+14, y+24);
    T.set(28, true, accent);
    doc.text(amountStr, margin+14, y+54);

    y += 90;

    // Datos alumno y metadatos
    const leftW  = (doc.internal.pageSize.getWidth()-2*margin)*0.55;
    const rightW = (doc.internal.pageSize.getWidth()-2*margin)*0.45;

    // Alumno
    T.set(12, true, primary); doc.text("Alumno", margin+14, y+20);
    T.set(14, true, primary); doc.text(row.student.fullName, margin+14, y+42);
    T.set(11, false, muted);
    const methodForPdf =
      (row.method && row.method.trim()) ||
      (paymentMethod && paymentMethod[row.student.id]) ||
      "Transfer."; // fallback

    // Normalizamos a frase bonita
    const prettyMap = { "Transfer.": "transferencia", "Efectivo": "efectivo", "Bizum": "Bizum" };
    const prettyMethod = prettyMap[methodForPdf] || methodForPdf;

    doc.text(`Pagado por ${prettyMethod}`, margin+14, y+80);

    // Marca de agua PAGADO
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    T.set(90, true, accent);
    doc.text("PAGADO", doc.internal.pageSize.getWidth()/2, doc.internal.pageSize.getHeight()/2, {
      angle: -35, align: "center"
    });
    doc.restoreGraphicsState();

    // Pie
    const footerY = doc.internal.pageSize.getHeight() - 36;
    T.set(10,false,muted);
    doc.text("Muchas gracias.", margin, footerY);

    return doc.output("blob");
  }


  async function downloadPaidPdf(row, month, currentStatus, logoUrl="/logo.png"){
    if (currentStatus !== "PAGADO") {
      alert("Sólo disponible cuando el estado es PAGADO.");
      return;
    }
    const blob = await makePaidPdf(row, month, { logoUrl });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Recibo-Pagado-${row.student.fullName.replace(/\s+/g,"_")}-${month}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  function onChangePaymentMethod(studentId, val){
    setPaymentMethod(prev=>({ ...prev, [studentId]: val }));
    const row = rows.find(r=>r.student.id===studentId);
    if (row) queueSave({ ...row, method: val });
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
        <div className={styles.headerRow}>
          {/* Izquierda: título */}
          <div className={styles.titleLeft}>
            <img src="/logo.png" alt="Edúcate" className={styles.logo}/>
          </div>
          {/* Derecha: botones + filtros */}
          <div className={styles.controls}>
            <div className={styles.controlsGroup}>
              <Link href="/" className={styles.btnOutline}>← Volver al horario</Link>
              <Link href="/invoices" className={styles.btnPrimary}>WhatsApp (cobros)</Link>
            </div>
            <div className={styles.controlsGroup}>
              <label className={styles.label}>Mes</label>
              <input
                type="month"
                value={month}
                onChange={e=>setMonth(e.target.value)}
                className={styles.input}
              />
              <input
                placeholder="Buscar nombre o curso..."
                value={q}
                onChange={e=>setQ(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th className={styles.right}>Clases</th>
              <th className={styles.right}>Horas</th>
              <th className={styles.right}>Tarifa (€/h)</th>
              <th className={styles.right}>Ajuste (min)</th>
              <th className={styles.right}>Importe</th>
              <th>Método</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>{
              const classesCount = r.items.reduce((acc,it)=> acc + it.count, 0);
              const statusClass =
                  (status[r.student.id] || r.stStatus) === "PAGADO" ? styles.rowPaid :
                  (status[r.student.id] || r.stStatus) === "ENVIADO" ? styles.rowSent :
                  "";
              return (
                  <tr key={r.student.id} className={statusClass}>
                    <td>
                      <div className={styles.nameRow}>
                        <div className={styles.name}>{r.student.fullName}</div>
                        <span className={`${styles.statusPill} ${
                          (status[r.student.id] || r.stStatus) === "PAGADO" ? styles.paid :
                          (status[r.student.id] || r.stStatus) === "ENVIADO" ? styles.sent :
                          styles.pending
                        }`}>
                          {status[r.student.id] || r.stStatus || "PENDIENTE"}
                        </span>
                      </div>
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
                    <td className={styles.muted}>{r.student.course}</td>
                    <td className={styles.right}>{r.items.reduce((acc,it)=> acc + it.count, 0)}</td>
                    <td className={styles.right}>{(r.totalMin/60).toFixed(2)}</td>
                    <td className={styles.right}>
                      <input
                        type="number" min={0} step={1}
                        className={styles.inputNum}
                        value={r.rate}
                        onChange={e=> onChangeRate(r.student.id, e.target.value) }
                      />
                    </td>
                    <td className={styles.right}>
                      <input
                        type="number" step={15}
                        className={styles.inputNum}
                        value={adjustMin[r.student.id]??0}
                        onChange={e=> onChangeAdj(r.student.id, e.target.value) }
                      />
                    </td>
                    <td className={`${styles.right} ${styles.colAmount}`}>
                      <span className={styles.amountNowrap}>{fmtMoney(r.amount)}</span>
                    </td>
                    <td className={styles.colMethod}>
                      <select
                        className={`${styles.select} ${styles.selectSm}`}
                        value={paymentMethod[r.student.id] || r.method || "Transfer."}
                        onChange={e=> onChangePaymentMethod(r.student.id, e.target.value)}
                      >
                        <option>Transfer.</option>
                        <option>Efectivo</option>
                        <option>Bizum</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className={styles.select}
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
                              onChangeStatus(r.student.id, "ENVIADO");
                            } catch {
                              alert("No se pudo copiar");
                            }
                          }}
                        >
                          Copiar
                        </button>
                        <button
                          className={styles.btn}
                          onClick={()=>{
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
                <td className={styles.right}><strong>{(totals.min/60).toFixed(2)}</strong></td> {/* Horas */}
                <td></td>   {/* Tarifa */}
                <td></td>   {/* Ajuste */}
                <td className={`${styles.right} ${styles.colAmount}`}><strong>{fmtMoney(totals.eur)}</strong></td> {/* Importe */}
                <td></td>   {/* Método */}
                <td></td>   {/* Estado */}
                <td></td>   {/* Acciones */}
              </tr>
            </tfoot>
        </table>
      </div>
    </div>
  );
}
