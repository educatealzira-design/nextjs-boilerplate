'use client';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const runtime = 'nodejs';        // fuerza Node (no Edge) para evitar problemas con Prisma/fetch
export const dynamic = 'force-dynamic'; // evita que Next intente pre-render estático

const DAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function toHHMM(mins){
  const h = Math.floor(mins/60), m = mins%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function endTime(startMin, durMin){ return toHHMM(startMin + durMin); }

function SendInner(){
  const sp = useSearchParams();                // ✅ ahora sí, dentro de Suspense
  const weekStart = sp.get('weekStart') || ''; // YYYY-MM-DD (lunes) o vacío

  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    async function load(){
      const [sRes, lRes] = await Promise.all([
        fetch('/api/students'),
        fetch(`/api/lessons?weekStart=${weekStart}`)
      ]);
      const s = await sRes.json();
      const l = await lRes.json();
      setStudents(s);
      setLessons(l);
    }
    load();
  }, [weekStart]);

  // Agrupa por alumno SOLO con la semana pedida
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
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>
        Enviar horario — semana {weekStart || '(actual)'}
      </h1>
      <p style={{ opacity: .7, marginBottom: 16 }}>
        Los mensajes se generan solo con las clases de la semana seleccionada.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {students.map(st => {
          const items = lessonsByStudent.get(st.id) || [];
          const msg = buildMessage(st, items);
          const phone = (st.phone || '').replace(/\D/g,'');
          const waLink = phone ? `https://wa.me/34${phone}?text=${encodeURIComponent(msg)}` : null;

          return (
            <div key={st.id} style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:12, background:'#fff' }}>
              <div style={{ fontWeight:600 }}>{st.fullName}</div>
              <div style={{ fontSize:12, opacity:.7, margin:'6px 0 10px' }}>
                {items.length} clase(s) esta semana
              </div>
              <textarea value={msg} readOnly rows={4}
                        style={{ width:'100%', resize:'vertical', fontFamily:'inherit', padding:8 }}/>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button onClick={()=>navigator.clipboard.writeText(msg)}
                        style={{ padding:'8px 10px', borderRadius:8, border:'1px solid #e5e7eb' }}>
                  Copiar
                </button>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                     style={{ padding:'8px 10px', borderRadius:8, background:'#25D366', color:'#fff', textDecoration:'none' }}>
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
  );
}

export default function Page(){
  return (
    <Suspense fallback={<div style={{ padding:16 }}>Cargando…</div>}>
      <SendInner />
    </Suspense>
  );
}
