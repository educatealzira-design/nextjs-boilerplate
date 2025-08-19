'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const DAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function toHHMM(mins){
  const h = Math.floor(mins/60), m = mins%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function endTime(startMin, durMin){ return toHHMM(startMin + durMin); }

export default function SendPage(){
  const sp = useSearchParams();
  const weekStart = sp.get('weekStart'); // YYYY-MM-DD (lunes)

  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    async function load(){
      const [sRes, lRes] = await Promise.all([
        fetch('/api/students'),
        fetch(`/api/lessons?weekStart=${weekStart ?? ''}`) // <-- SOLO esa semana
      ]);
      const s = await sRes.json();
      const l = await lRes.json();
      setStudents(s);
      setLessons(l);
    }
    load();
  }, [weekStart]);

  // Agrupa por alumno SOLO con los de esta semana ya traídos
  const lessonsByStudent = useMemo(() => {
    const map = new Map();
    for (const ls of lessons) {
      const key = ls.studentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ls);
    }
    // ordena por dia/hora y quita duplicados exactos
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

  function teacherText(t){
    return t === 'NURIA' ? 'conmigo' : 'con Santi';
  }

  function buildMessage(student, items){
    // items: SOLO la semana actual
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
          const phone = (st.phone || '').replace(/\D/g,''); // limpiar espacios/guiones
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
