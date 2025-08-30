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

function SendInner(){
  const sp = useSearchParams();                 // ✅ dentro de Suspense
  const weekStartStr = sp.get('weekStart') || ''; // YYYY-MM-DD o vacío
  const weekStart = weekStartStr ? new Date(`${weekStartStr}T00:00:00`) : mondayOf(new Date());

  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [doneIds, setDoneIds] = useState(new Set()); //ids de tarjetas marcadas como hechas (copiado o whatsapp)
  const markDone = (id) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };


  useEffect(() => {
    async function load(){
      const [sRes, lRes] = await Promise.all([
        fetch('/api/students'),
        fetch(`/api/lessons?weekStart=${weekStartStr}`)
      ]);
      const s = await sRes.json();
      const l = await lRes.json();
      setStudents(s);
      setLessons(l);
    }
    load();
  }, [weekStartStr]);

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

  function buildMessage(student, items){
    if (!items || items.length === 0) {
      return `Hola ${student.fullName.split(' ')[0]}, esta semana no tienes clases programadas.`;
    }
    const parts = items.map(ls => {
      const start = (ls.actualStartMin ?? ls.startMin);
      const dur = (ls.actualDurMin ?? ls.durMin);
      return `${DAY_NAMES[ls.dayOfWeek]} de ${toHHMM(start)} a ${endTime(start, dur)} ${teacherText(ls.teacher)}`;
    });
    const body = parts.length === 1
      ? parts[0]
      : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
    return `Hola ${student.fullName.split(' ')[0]}, esta semana tienes clase ${body}. Muchas gracias.`;
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
          <a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
            Abrir WhatsApp Web
          </a>
          <Link href="/students" className={styles.btnPrimary}>BD</Link>
          <div className={styles.weekBadge}>
            Semana: {ddmmyy(weekStart)} — {ddmmyy(addDays(weekStart, 4))}
          </div>
        </div>
      </div>

      {/* Contenido A PANTALLA COMPLETA */}
      <div className={styles.fullWidth}>
        <div className={styles.board}>
          <div className={styles.cardsGrid}>
            {students.map(st => {
              const items = lessonsByStudent.get(st.id) || [];
              const msg = buildMessage(st, items);
              const phone = (st.phone || '').replace(/\D/g,'');
              const waLink = phone ? `https://wa.me/34${phone}?text=${encodeURIComponent(msg)}` : null;

              const isDone = doneIds.has(st.id);

              const handleCopy = async () => {
                try {
                  await navigator.clipboard.writeText(msg);
                  markDone(st.id);
                } catch (e) {
                  console.error('No se pudo copiar', e);
                }
              };

              const handleWhatsAppClick = () => {
                // se marca como hecho aunque se abra en nueva pestaña
                markDone(st.id);
              };

              return (
                <div
                  key={st.id}
                  className={`${styles.card} ${isDone ? styles.cardDone : ''}`}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontWeight:600 }}>{st.fullName}</div>
                    {isDone && <span className={styles.donePill}>Hecho</span>}
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
