'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './send.module.css'; // ⬅️ reutilizamos estilos de la portada

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function toHHMM(mins){
  const h = Math.floor(mins/60), m = mins%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function endTime(startMin, durMin){ return toHHMM(startMin + durMin); }

// Formatea el rango "Semana: dd/mm/yy — dd/mm/yy"
function ddmmyy(dt){
  const dd=String(dt.getDate()).padStart(2,'0');
  const mm=String(dt.getMonth()+1).padStart(2,'0');
  const yy=String(dt.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
function mondayOf(date){
  const d = new Date(date); d.setHours(0,0,0,0);
  const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow);
  return d;
}
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function toMinutes(hhmm) {
  const [h, m] = String(hhmm||'0:0').split(':').map(Number);
  return (Number(h)||0)*60 + (Number(m)||0);
}

function labelDot(mins) {
  const h = Math.floor(mins/60), m = mins%60;
  return m ? `${h}.${String(m).padStart(2,'0')}` : `${h}`;
}

function lessonBounds(ls) {
  const start = ls.actualStartMin ?? ls.startMin;
  const dur   = ls.actualDurMin   ?? ls.durMin;
  return { start, end: start + dur };
}

function mergeContiguousByTeacher(dayLessons) {
  const arr = dayLessons
    .map(ls => {
      const { start, end } = lessonBounds(ls);
      return { ...ls, start, end };
    })
    .sort((a,b) => a.start - b.start || a.teacher.localeCompare(b.teacher));

  const out = [];
  for (const cur of arr) {
    const prev = out[out.length - 1];
    if (prev && prev.teacher === cur.teacher && prev.end === cur.start) {
      prev.end = cur.end;              // une el rango
      prev._mergedIds.push(cur.id);    // opcional: saber qué ids se unieron
    } else {
      out.push({ ...cur, _mergedIds: [cur.id] });
    }
  }
  return out;
}

function SendInner(){
  function toYYYYMMDD(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
  const sp = useSearchParams();                 // ✅ dentro de Suspense
  const weekStartStr = sp.get('weekStart') || ''; // YYYY-MM-DD o vacío
  const weekStart = weekStartStr ? new Date(`${weekStartStr}T00:00:00`) : mondayOf(new Date());
  const weekStartIso = useMemo(() => toYYYYMMDD(weekStart), [weekStart]);
  const weekKey = useMemo(() => {
    const raw = (weekStartStr || toYYYYMMDD(weekStart)).trim();
    // normaliza a YYYY-MM-DD, aunque venga raro
    const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return toYYYYMMDD(weekStart); // fallback seguro
    const y = m[1];
    const mm = String(Number(m[2])).padStart(2, '0');
    const dd = String(Number(m[3])).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }, [weekStartStr, weekStart]);
  
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set()); //ids de tarjetas marcadas como hechas (copiado o whatsapp)
  const [sendByStudent, setSendByStudent] = useState(new Map());
  const markDone = (id) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // 🔎 Buscador
  const [q, setQ] = useState('');

  const filteredStudents = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;

    return students.filter(st => {
      const name     = String(st.fullName || '').toLowerCase();
      const guardian = String(st.guardianName || '').toLowerCase();
      const course   = String(st.course || '').toLowerCase();
      return (
        name.includes(t) ||
        guardian.includes(t) ||
        course.includes(t)
      );
    });
  }, [students, q]);

  async function persistDone(studentId) {
    try {
      console.log('persistDone -> studentId:', studentId, 'weekKey:', weekKey);
      const res = await fetch('/api/sends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          weekKey,   // SIEMPRE YYYY-MM-DD correcto
          status: 'ENVIADO'
        })
      });
      if (res.ok) {
        const row = await res.json();
        // actualiza mapas locales
        setSendByStudent(prev => {
          const next = new Map(prev);
          next.set(studentId, row);
          return next;
        });
        } else {
          const text = await res.text();
          console.error('POST /api/sends no OK:', res.status, text);
      }
    } catch (e) {
      console.error('No se pudo guardar ENVIADO', e);
    }
  }
  async function undoDone(studentId) {
    try {
      const row = sendByStudent.get(studentId);
      if (row?.id) {
        const res = await fetch(`/api/sends/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'PENDIENTE' })
        });
        if (res.ok) {
          const updated = await res.json();
          setSendByStudent(prev => {
            const next = new Map(prev);
            next.set(studentId, updated);
            return next;
          });
        }
      }
      setDoneIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    } catch (e) {
      console.error('No se pudo deshacer', e);
    }
  }


  useEffect(() => {
    async function load(){
      const [sRes, lRes, sendsRes] = await Promise.all([
       fetch('/api/students'),
       fetch(`/api/lessons?weekStart=${weekKey}`),
       fetch(`/api/sends?weekKey=${weekKey}`)
     ]);
      const s = await sRes.json();
      const l = await lRes.json();
      const sends = await sendsRes.json();
      setStudents(s);
      setLessons(l);

      // mapa studentId -> send row
      const map = new Map();
      if (Array.isArray(sends)) {
        for (const r of sends) map.set(r.studentId, r);
      }
      setSendByStudent(map);

      // set de hechos
      const done = new Set();
      for (const [sid, r] of map.entries()) {
        if (r.status === 'ENVIADO') done.add(sid);
      }
      setDoneIds(done);
    }
    load();
  }, [weekKey]);

  // Agrupa y ordena SOLO la semana recibida; evita duplicados exactos
  const lessonsByStudent = useMemo(() => {
    const map = new Map();
    for (const ls of lessons) {
      if (!map.has(ls.studentId)) map.set(ls.studentId, []);
      map.get(ls.studentId).push(ls);
    }
    for (const [sid, arr] of map) {
      const seen = new Set();
      const ordered = arr
        .sort((a,b)=> a.dayOfWeek-b.dayOfWeek || a.startMin-b.startMin || (a.teacher>b.teacher?1:-1))
        .filter(ls => {
          const k = `${ls.dayOfWeek}-${ls.startMin}-${ls.teacher}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      map.set(sid, ordered);
    }
    return map;
  }, [lessons]);

  function teacherText(t){ return t === 'NURIA' ? 'conmigo' : 'con Santi'; }

  // obtiene el primer nombre (o cadena vacía)
  function firstName(s = "") {
    return String(s).trim().split(/\s+/)[0] || "";
  }

  // si el curso es de primaria (para posibles mensajes distintos)
  function isPrimary(student) {
    const c = String(student?.course || "").toLowerCase();
    // detecta “primaria”, “prim.”, “1º primaria”, “5 pri”, etc.
    return /\bprim/.test(c);
  }

  // si es 1º o 2º de ESO (para usar el mensaje a padres cuando no hay clases)
  function isLowerESO(student) {
    // normaliza: minúsculas y sin º/ª para simplificar patrones
    const c = String(student?.course || "")
      .toLowerCase()
      .replace(/[\u00BA\u00AA]/g, ""); // elimina º ª

    // cubre variantes: "1 eso", "1º eso", "1ºeso", "1 de eso", "2 eso", etc.
    return /\b(?:1|2)\s*(?:o|\b)?\s*(?:de\s*)?eso\b/.test(c);
  }

  // --- Detección profesor por defecto según curso/asignaturas ---
  const SCI = ['matemáticas','matematicas','física','fisica','química','quimica'];
  const LET = ['castellano','valenciano','inglés','ingles'];

  function normSubj(s=''){ return s.toLowerCase().trim(); }
  function hasOnly(set, arr){
    if (arr.length === 0) return false;
    return arr.every(x => set.includes(normSubj(x)));
  }

  function isPrimary(student){
    return /\bprim/.test(String(student?.course||'').toLowerCase());
  }

  /**
   * Devuelve 'NURIA' | 'SANTI' | null
   * - Primaria => 'NURIA'
   * - Solo ciencias => 'SANTI'
   * - Solo letras  => 'NURIA'
   * - Mixto o sin asignaturas => null
   */
  function inferDefaultTeacher(student){
    if (isPrimary(student)) return 'NURIA';

    const subjects = Array.isArray(student?.subjects) ? student.subjects : [];
    const names = subjects.map(s => s?.name || '').filter(Boolean).map(normSubj);

    if (names.length === 0) return null;

    const onlySci = hasOnly(SCI, names);
    const onlyLet = hasOnly(LET, names);

    if (onlySci && !onlyLet) return 'SANTI';
    if (onlyLet && !onlySci) return 'NURIA';
    return null; // mezcla
  }

  // Para el texto por-clase si NO hay profesor fijo
  function teacherSuffix(t){
    return t === 'NURIA' ? ' conmigo' : ' con Santi';
  }

  // nombre de pila seguro
  function firstName(s=''){ return String(s).trim().split(/\s+/)[0] || ''; }

  function buildMessage(student, items) {
    const child = firstName(student.fullName);
    const parent = firstName(student.guardianName) || "familia";
    const fixedTeacher = inferDefaultTeacher(student);

    // Sin clases esta semana
    if (!items || items.length === 0) {
      if (isPrimary(student) || isLowerESO(student)) {
        return `Hola ${parent}, la semana que viene ${child} no tendrá clases programadas.`;
      }
      return `Hola ${child}, la semana que viene no tendrás clases programadas.`;
    }

    // Agrupar por día lectivo y fusionar tramos contiguos
    const byDay = new Map();
    for (const ls of items) {
      if (!byDay.has(ls.dayOfWeek)) byDay.set(ls.dayOfWeek, []);
      byDay.get(ls.dayOfWeek).push(ls);
    }

    const mergedLines = [];
    for (const d of [1, 2, 3, 4, 5]) { // Lun–Vie
      const dayLs = (byDay.get(d) || []).slice()
        .sort((a,b) => (a.actualStartMin ?? a.startMin) - (b.actualStartMin ?? b.startMin));
      if (!dayLs.length) continue;

      const merged = mergeContiguousByTeacher(dayLs);
      const parts = merged.map(seg => {
        const dur = seg.end - seg.start;
        // Si hay profesor fijo (Primaria / solo ciencias / solo letras) NO añadimos “con …”
        const prof = fixedTeacher ? '' : teacherSuffix(seg.teacher);
        if (dur <= 60) return `a las ${labelDot(seg.start)}${prof}`;
        return `de ${labelDot(seg.start)} a ${labelDot(seg.end)}${prof}`;
      });

      mergedLines.push(`${DAY_NAMES[d]} ${parts.join(' y ')}`);
    }

    // Un solo día: formato inline
    if (mergedLines.length === 1) {
      const body = mergedLines[0];
      if (isPrimary(student)) {
        return `Hola ${parent}, ${child} tendrá clase ${body}. Muchas gracias.`;
      }
      return `Hola ${child}, la semana que viene tendrás clase ${body}. Muchas gracias.`;
    }

    // Varios días: formato lista con viñetas
    const listItems = mergedLines.map(line => `* ${line}`).join('\n');
    if (isPrimary(student)) {
      return `Hola ${parent}, ${child} tendrá clase:\n${listItems}\nMuchas gracias.`;
    }
    return `Hola ${child}, la semana que viene tendrás clase:\n${listItems}\nMuchas gracias.`;
  }

  return (
    <div className={styles.layout}>
      {/* Cabecera (misma estética que la portada) */}
      <div className={styles.header}>
        <div className={styles.title}>
          <img src="/logo.png" alt="Edúcate" style={{ height:'70px', width:'auto'}}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <Link href="/" className={styles.btnOutline}>← Volver al horario</Link>
          <Link href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer" className={styles.btnPrimarySend}>
            <img src="/whatsapp.png" alt="Enviar horario" style={{ height: '34px', width: '34px', display: 'block' }} />
          </Link>
          <Link href="/students" className={styles.btnPrimaryBD}>
              <img src="/BD.png" alt="Base de datos" style={{ height: '34px', width: '34px', display: 'block' }} />
          </Link>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            style={{
              padding: '6px 10px',
              border: '1px solid #d6d3d1',
              borderRadius: 8,
              minWidth: 100,
              outline: 'none',
              backgroundColor: '#f3efeb',
            }}
          />
          <div className={styles.weekBadge}>
            Semana: {ddmmyy(weekStart)} — {ddmmyy(addDays(weekStart, 4))}
          </div>
        </div>
      </div>

      {/* Contenido A PANTALLA COMPLETA */}
      <div className={styles.fullWidth}>
        <div className={styles.board}>
          <div className={styles.cardsGrid}>
            {filteredStudents.map(st => {
              const items = lessonsByStudent.get(st.id) || [];
              const msg = buildMessage(st, items);
              const phone = (st.phone || '').replace(/\D/g,'');
              const waLink = phone ? `https://wa.me/34${phone}?text=${encodeURIComponent(msg)}` : null;

              const isDone = doneIds.has(st.id);

              const handleCopy = async () => {
                try {
                  await navigator.clipboard.writeText(msg);
                  markDone(st.id);
                  persistDone(st.id);
                } catch (e) {
                  console.error('No se pudo copiar', e);
                }
              };

              const handleWhatsAppClick = () => {
                // se marca como hecho aunque se abra en nueva pestaña
                markDone(st.id);
                persistDone(st.id);
              };

              return (
                <div
                  key={st.id}
                  className={`${styles.card} ${isDone ? styles.cardDone : ''}`}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontWeight:600 }}>{st.fullName}</div>
                    {isDone && (
                      <span className={styles.donePill}>
                        Hecho
                        <button
                          type="button"
                          className={styles.doneClose}
                          aria-label="Desmarcar envío"
                          title="Desmarcar"
                          onClick={(e)=>{ e.preventDefault(); undoDone(st.id); }}
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize:12, opacity:.7, marginBottom:10 }}>
                    {items.length} clase(s) esta semana
                  </div>

                  <textarea
                    value={msg}
                    readOnly
                    rows={4}
                    className={styles.msgBox}
                  />

                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button onClick={handleCopy} className={styles.btnOutline}>
                      Copiar
                    </button>

                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnPrimary}
                        onClick={handleWhatsAppClick}
                      >
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
    </div>
  );
}

export default function Page(){
  return (
    <Suspense fallback={<div style={{ padding:16 }}>Cargando…</div>}>
      <SendInner />
    </Suspense>
  );
}
