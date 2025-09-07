'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import {
  DndContext, useSensor, useSensors, PointerSensor,
  closestCenter, useDroppable, useDraggable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './page.module.css';


const DAYS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mié' },
  { key: 4, label: 'Jue' },
  { key: 5, label: 'Vie' }
];

// para poner la fecha en el horario

function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function toISODateLocal(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function mondayOfWeek(date = new Date()){
  const d = new Date(date); d.setHours(0,0,0,0);
  const dow = (d.getDay() + 6) % 7; // Lunes=0
  d.setDate(d.getDate() - dow);
  return d;
}
function ddmmyy(dt){
  const d = String(dt.getDate()).padStart(2,'0');
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const y = String(dt.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

const TEACHERS = [
  { key: 'NURIA', label: 'Nuria' },
  { key: 'SANTI', label: 'Santi' },
];

const START_HOUR = 15.5;
const END_HOUR = 21.5;
const SLOT_MIN = 60;

function toMinutes(hhmm) {
  const [h, m] = String(hhmm||'0:0').split(':').map(Number);
  return (Number(h)||0)*60 + (Number(m)||0);
}
function formatDur(min) {
  const h = Math.floor((min||0)/60), m = (min||0)%60;
  return `${h?`${h}h`:''}${h&&m?' ':''}${m?`${m}m`:''}` || '0m';
}function minutesToLabel(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function range(start, end, step){ const out=[]; for(let i=start;i<=end;i+=step) out.push(i); return out; }
function overlaps(aStart, aDur, bStart, bDur){ const aEnd=aStart+aDur, bEnd=bStart+bDur; return aStart<bEnd && bStart<aEnd; }

function Draggable({ id, children, ...props }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = { transform: CSS.Translate.toString(transform), touchAction: 'none' };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${styles.draggable} ${isDragging ? styles.dragging : ''} ${props.className||''}`}
    >
      {children}
    </div>
  );
}

function DroppableCell({ id, children, isOver, className }) {
  const { setNodeRef, isOver: over } = useDroppable({ id });
  const active = isOver ?? over;
  return (
    <div
      ref={setNodeRef}
      className={`${styles.droppableCell} ${active ? styles.droppableActive : ''} ${className || ''}`}
    >
      {children}
    </div>
  );
}


function EventBlock({ lesson, student, conflict, teacherKey, onDelete, onSetActual}) {
  const [open, setOpen] = useState(false);
  const displayStart = lesson.actualStartMin ?? lesson.startMin;
  const displayDur   = lesson.actualDurMin   ?? lesson.durMin;

  const [from, setFrom] = useState(() => {
    const h = String(Math.floor(displayStart/60)).padStart(2,'0');
    const m = String(displayStart%60).padStart(2,'0');
    return `${h}:${m}`;
  });
  const [to, setTo] = useState(() => {
    const end = displayStart + displayDur;
    const h = String(Math.floor(end/60)).padStart(2,'0');
    const m = String(end%60).padStart(2,'0');
    return `${h}:${m}`;
  });
  function stop(e){ e.stopPropagation(); e.preventDefault(); }


  return (
    <div
      className={styles.eventBlock}
      title={`${student?.fullName||'(Alumno)'} — ${minutesToLabel(displayStart)} · ${formatDur(displayDur)}`}
    >
      {/* borrar */}
      <button
        aria-label="Eliminar" title="Eliminar"
        onPointerDown={stop} onMouseDown={stop} onTouchStart={stop}
        onClick={(e)=>{ stop(e); onDelete?.(); }}
        className={styles.deleteBtn}
      >✕</button>

      {/* reloj */}
      <button
        aria-label="Duración real" title="Duración real"
        onPointerDown={stop} onMouseDown={stop} onTouchStart={stop}
        onClick={(e)=>{ stop(e); setOpen(v=>!v); }}
        className={`${styles.clockBtn} ${lesson.actualDurMin!=null ? styles.clockActive : ''}`}
      >🕒</button>

      <div className={styles.eventText}>
        <div className={`${styles.eventName} ${conflict ? styles.conflictName : ''}`}>
          {student?.fullName || '(Alumno)'}
        </div>
        <div className={styles.eventMeta}>
          {minutesToLabel(displayStart)} · {formatDur(displayDur)}
        </div>
      </div>

      {open && (
        <div className={styles.popover} onClick={stop}>
          <div className={styles.popTitle}>Duración real</div>
          <div className={styles.popRow}>
            <button className={styles.popBtn} onClick={()=>{ onSetActual?.({ presetMin:45 }); setOpen(false); }}>45 min</button>
            <button className={styles.popBtn} onClick={()=>{ onSetActual?.({ presetMin:60 }); setOpen(false); }}>60 min</button>
            <button className={styles.popBtn} onClick={()=>{ onSetActual?.({ presetMin:90 }); setOpen(false); }}>90 min</button>
          </div>
          <div className={styles.popSub}>O personaliza</div>
          <div className={styles.popRow}>
            <label className={styles.popLabel}>De</label>
            <input type="time" value={from} onChange={e=>setFrom(e.target.value)} className={styles.popInput}/>
            <label className={styles.popLabel}>a</label>
            <input type="time" value={to} onChange={e=>setTo(e.target.value)} className={styles.popInput}/>
          </div>
          <div className={styles.popActions}>
            <button
              className={styles.popLink}
              onClick={()=>{ onSetActual?.({ startHHMM:from, endHHMM:to }); setOpen(false); }}
            >Guardar</button>
            <button
              className={styles.popLink}
              onClick={()=>{ onSetActual?.({ clear:true }); setOpen(false); }}
            >Restablecer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Agrupación por etapas
function normalize(s){ return String(s||'').toLowerCase().trim(); }
// Devuelve uno de: 1-2PRIM, 3-4PRIM, 5-6PRIM, 1ESO, 2ESO, 3ESO, 4ESO, 1BACH, 2BACH, CICLO, Otros
function courseGroup(course){
  const c = normalize(course);

  // PRIMARIA: “1º primaria”, “2 primaria”, etc.
  const prim = c.match(/(\d)\s*º?\s*(?:prim|primaria)/);
  if (prim) {
    const n = Number(prim[1]);
    if (n === 1 || n === 2) return '1-2PRIM';
    if (n === 3 || n === 4) return '3-4PRIM';
    if (n === 5 || n === 6) return '5-6PRIM';
  }
  if (/\bprimaria?\b/.test(c)) return '1-2PRIM'; // fallback si no especifican curso

  // ESO: “1º ESO”, “3 ESO”…
  const eso = c.match(/(\d)\s*º?\s*eso/);
  if (eso) return `${eso[1]}ESO`;

  // BACH: “1º Bach”, “2 bachillerato”
  const bach = c.match(/(\d)\s*º?\s*(?:bach|bachiller|bachillerato)/);
  if (bach) return `${bach[1]}BACH`;

  // CICLO / FP
  if (/(^|\b)(fp|ciclo|ciclos|grado medio|grado superior|formativo)(\b|$)/.test(c)) return 'CICLO';

  return 'Otros';
}

const GROUPS = ['Todos','1-2PRIM','3-4PRIM','5-6PRIM','1ESO','2ESO','3ESO','4ESO','1BACH','2BACH','CICLO','Otros'];

export default function Page(){
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [textQ, setTextQ] = useState('');
  const [group, setGroup] = useState('Todos');
  const exportRefNuria = useRef(null);
  const exportRefSanti = useRef(null);
  const [weekStart, setWeekStart] = useState(()=> addDays(mondayOfWeek(new Date()), 7));
  const [weekSaved, setWeekSaved] = useState(false);

  // DIAS DE LA SEMANA DEL HORARIO
  const weekDates = useMemo(() => {
    const weekdayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
    return DAYS.map((d,i) => {
      const dt = addDays(weekStart, i);
      const dayNum = String(dt.getDate()).padStart(2, '0'); // "25"
      return { ...d, pretty: `${capitalize(weekdayFmt.format(dt))} ${dayNum}`, date: dt };
    });
  }, [weekStart]);

  // EXPORTAR A PDF — encajar TODO (contain), pegado arriba
  async function exportElementToPdf(el, fileName){
    if (!el) return;
    const [{ default: html2canvas }, jsPDFmod] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

    // Limpia márgenes del contenedor, pero NO forces altura
    const prev = {
      margin: el.style.margin,
      padding: el.style.padding,
      width: el.style.width,
      boxSizing: el.style.boxSizing
    };
    el.style.margin = '0';
    el.style.padding = '0';
    el.style.boxSizing = 'border-box';
    // (no tocar el height: dejamos que mida lo que necesite)

    await new Promise(r => requestAnimationFrame(r));

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      // asegura que capture todo el ancho/alto real del nodo
      windowWidth:  el.scrollWidth,
      windowHeight: el.scrollHeight,
      scrollY: -window.scrollY
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDFmod.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // === Escalado CONTAIN, alineado arriba ===
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.min(pageW / cw, pageH / ch);  // cabe todo (sin recortes)
    const imgW = cw * scale;
    const imgH = ch * scale;

    const x = (pageW - imgW) / 2; // centrado horizontal → las horas no se cortan
    const y = 0;                  // pegado arriba

    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');
    pdf.save(fileName);

    // Restaurar estilos
    el.style.margin    = prev.margin;
    el.style.padding   = prev.padding;
    el.style.width     = prev.width;
    el.style.boxSizing = prev.boxSizing;
  }




  async function exportTeacher(teacherKey){
    const el = teacherKey === 'NURIA' ? exportRefNuria.current : exportRefSanti.current;
    await exportElementToPdf(el, `Horario-${teacherKey}.pdf`);
  }

  async function seedFromLastIfEmpty(weekStartDate) {
    // weekStartDate es un Date (lunes de la semana actual en tu state)
    const w = toISODateLocal(weekStartDate);
    try {
      const res = await fetch('/api/lessons/seed-from-last', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ weekStart: w })
      });
      // 201 -> se sembró; 200/404 -> no hacía falta o no hay fuente; todos OK para continuar
      return res.ok;
    } catch (e) {
      console.error('seed-from-last error', e);
      return false;
    }
  }

  async function loadAll(autoCloneIfEmpty = true){
    const w = toISODateLocal(weekStart);
    const [sRes, lRes, stRes] = await Promise.all([
      fetch('/api/students'),
      fetch(`/api/lessons?weekStart=${w}`),
      fetch(`/api/weeks?weekStart=${w}`)
    ]);
    const s = await sRes.json();
    const l = await lRes.json();
    const st = stRes.ok ? await stRes.json() : { saved:false };

    setStudents(s);
    setLessons(l.map(x=>({
      id:x.id, studentId:x.studentId, teacher:x.teacher, dayOfWeek:x.dayOfWeek,
      startMin:x.startMin, durMin:x.durMin,
      actualStartMin:x.actualStartMin ?? null, actualDurMin:x.actualDurMin ?? null,
    })));
    setWeekSaved(!!st.saved);

    // 👉 Nueva lógica: si la semana está vacía, siembra desde la última guardada
    if (autoCloneIfEmpty && l.length === 0) {
      const seededOk = await seedFromLastIfEmpty(weekStart);
      if (seededOk) {
        // Recarga SOLO las lessons de esta semana tras sembrar
        const l2Res = await fetch(`/api/lessons?weekStart=${w}`);
        const l2 = await l2Res.json();
        setLessons(l2.map(x=>({
          id:x.id, studentId:x.studentId, teacher:x.teacher, dayOfWeek:x.dayOfWeek,
          startMin:x.startMin, durMin:x.durMin,
          actualStartMin:x.actualStartMin ?? null, actualDurMin:x.actualDurMin ?? null,
        })));
      }
    }
  }
  useEffect(()=>{ loadAll(); }, []);
  useEffect(()=>{ loadAll(); }, [weekStart]);

  const timeSlots = useMemo(()=> range(toMinutes(START_HOUR), toMinutes(END_HOUR), SLOT_MIN), []);

  function conflictLocal(lesson){
    const student = students.find(s=>s.id===lesson.studentId);
    if(!student) return null;
    const ex = (student.extras||[]).find(ex => ex.dayOfWeek===lesson.dayOfWeek && overlaps(lesson.startMin, lesson.durMin, ex.startMin, ex.durMin));
    return ex||null;
  }

  const countsByStudent = useMemo(()=>{
    const m = new Map();
    for(const ls of lessons){ m.set(ls.studentId, (m.get(ls.studentId)||0)+1); }
    return m;
  }, [lessons]);

  function formatHoursFromMinutes(mins){
    const h = (mins || 0) / 60;
    return Number.isInteger(h) ? `${h}h` : `${Math.round(h*10)/10}h`;
  }

  const plannedMinutesByStudent = useMemo(()=>{
    const m = new Map();
    for (const ls of lessons) {
      const mins = (ls.actualDurMin != null ? ls.actualDurMin : ls.durMin) || 0;
      m.set(ls.studentId, (m.get(ls.studentId) || 0) + mins);
    }
    return m;
  }, [lessons]);


  const filtered = useMemo(()=>{
    return students.filter(s=>{
      const matchesText = s.fullName.toLowerCase().includes(textQ.toLowerCase()) || (s.course||'').toLowerCase().includes(textQ.toLowerCase());
      const g = courseGroup(s.course);
      const matchesGroup = (group==='Todos') ? true : (g===group);
      return matchesText && matchesGroup;
    });
  }, [students, textQ, group]);

  const eventsMap = useMemo(()=>{
    const map = new Map();
    for(const ls of lessons){
      const key = `${ls.dayOfWeek}:${ls.startMin}:${ls.teacher}`;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(ls);
    }
    return map;
  }, [lessons]);

  function alreadyHasInCell(studentId, dayOfWeek, startMin, excludeId){
    return lessons.some(ls =>
      ls.studentId===studentId &&
      ls.dayOfWeek===dayOfWeek &&
      ls.startMin===startMin &&
      ls.id !== excludeId
    );
  }

  async function createLesson({ studentId, teacher, dayOfWeek, startMin }){
    const w = toISODateLocal(weekStart);
    const st = students.find(s => s.id === studentId);
    const durMin = st?.sessionDurMin ?? 60;

    const res = await fetch('/api/lessons', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ studentId, teacher, dayOfWeek, startMin, durMin, weekStart: w })
    });
    if (res.status === 201) {
      const data = await res.json();
      setLessons(prev => [...prev, {
        id:data.id, studentId:data.studentId, teacher:data.teacher, dayOfWeek:data.dayOfWeek,
        startMin:data.startMin, durMin:data.durMin,
        actualStartMin:data.actualStartMin ?? null, actualDurMin:data.actualDurMin ?? null,
      }]);
      return { ok:true };
    }
    if (res.status === 409) { alert('⚠️ Ese alumno ya está en esta franja.'); return { ok:false }; }
    alert('Error creando clase'); return { ok:false };
  }

  async function moveLesson(id, { teacher, dayOfWeek, startMin }){
    const w = toISODateLocal(weekStart);
    const current = lessons.find(l=>l.id===id);
    if (!current) return { ok:false };
    if (alreadyHasInCell(current.studentId, dayOfWeek, startMin, id)) { alert('⚠️ Ese alumno ya está en esta franja.'); return { ok:false }; }

    const res = await fetch(`/api/lessons/${id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ teacher, dayOfWeek, startMin, weekStart: w })
    });
    if (res.ok) {
      const data = await res.json();
      setLessons(prev => prev.map(l => l.id === id ? {
        ...l, teacher:data.teacher, dayOfWeek:data.dayOfWeek, startMin:data.startMin
      } : l));
      return { ok:true };
    }
    if (res.status === 409) { alert('⚠️ Ese alumno ya está en esta franja.'); return { ok:false }; }
    alert('Error moviendo clase'); return { ok:false };
  }

  async function deleteLesson(id){
    const res = await fetch(`/api/lessons/${id}`, { method:'DELETE' });
    if (res.ok) setLessons(prev=>prev.filter(l=>l.id!==id)); else alert('Error eliminando');
  }

  function CellTeacher({ dia, inicioMin, teacherKey, className  }){
    const id = `cell:${dia}:${inicioMin}:${teacherKey}`;
    const here = eventsMap.get(`${dia}:${inicioMin}:${teacherKey}`) || [];
    const bgClass = teacherKey === 'NURIA' ? styles.cellNuria : styles.cellSanti;

    return (
      <DroppableCell id={id} className={`${bgClass} ${className || ''}`}>
        <div className={styles.cellInner}>
          {here.map(ls => {
            const student = students.find(s=>s.id===ls.studentId);
            const conflict = conflictLocal(ls);
            return (
              <Draggable key={ls.id} id={`event:${ls.id}`}>
                <EventBlock
                  lesson={ls}
                  student={student}
                  conflict={!!conflict}
                  teacherKey={teacherKey}
                  onDelete={()=>deleteLesson(ls.id)}
                  onSetActual={(opts)=>setLessonActual(ls.id, opts)}
                />
              </Draggable>
            );
          })}
        </div>
      </DroppableCell>
    );
  }

  function onDragEnd(e){
    const { active, over } = e; if(!over) return;
    const [_, diaStr, inicioStr, teacherKey] = String(over.id).split(':');
    const dayOfWeek = Number(diaStr); const startMin = Number(inicioStr);

    if(String(active.id).startsWith('student:')){
      const studentId = String(active.id).split(':')[1];
      createLesson({ studentId, teacher: teacherKey, dayOfWeek, startMin });
    } else if (String(active.id).startsWith('event:')){
      const id = String(active.id).split(':')[1];
      const curr = lessons.find(l=>l.id===id);
      if (!curr) return;
      // ✅ no-op: mismo sitio → no muevas ni valides
      if (curr.teacher === teacherKey && curr.dayOfWeek === dayOfWeek && curr.startMin === startMin) return;
      moveLesson(id, { teacher: teacherKey, dayOfWeek, startMin });
    }
  }


  const anyConflict = lessons.some(ls => conflictLocal(ls));
  const gridColsStyle = { gridTemplateColumns: `140px repeat(${timeSlots.length}, 1fr)` };

  async function setLessonActual(id, { startHHMM, endHHMM, presetMin, clear }) {
    const curr = lessons.find(l => l.id === id);
    if (!curr) { alert('Clase no encontrada'); return { ok:false }; }

    let actualStartMin, actualDurMin;

    if (clear) {
      actualStartMin = null;
      actualDurMin = null;
    } else if (startHHMM && endHHMM) {
      const s = toMinutes(startHHMM);
      const e = toMinutes(endHHMM);
      if (e <= s) { alert('La hora de fin debe ser posterior a la de inicio.'); return { ok:false }; }
      actualStartMin = s;
      actualDurMin = e - s;
    } else if (typeof presetMin === 'number') {
      actualDurMin = presetMin;
      actualStartMin = curr.actualStartMin ?? curr.startMin; // ← importante
    } else {
      return { ok:false };
    }

    const res = await fetch(`/api/lessons/${id}`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        actualStartMin,
        actualDurMin,
        weekStart: toISODateLocal(weekStart)
      })
    });

    if (!res.ok) { alert('Error guardando duración real'); return { ok:false }; }
    const data = await res.json();

    setLessons(prev => prev.map(l => l.id===id ? {
      ...l,
      actualStartMin: data.actualStartMin ?? null,
      actualDurMin: data.actualDurMin ?? null,
    } : l));

    return { ok:true };
  }

  // Devuelve "Nombre Apellido" (primer nombre + primer apellido)
  function formatStudentName(st, siblings) {
    if (!st?.fullName) return '(Alumno)';

    const parts = st.fullName.trim().split(/\s+/);
    const name = parts[0];                 // primer nombre
    const surname = parts[1] || '';        // primer apellido (si existe)

    // ¿Cuántos en esta franja comparten este nombre?
    const sameNameCount = siblings.filter(other => {
      if (!other?.fullName) return false;
      return other.fullName.trim().split(/\s+/)[0] === name;
    }).length;

    if (sameNameCount > 1 && surname) {
      return `${name} ${surname.charAt(0)}.`;  // Ej: "Paula S."
    }
    return name;                               // Ej: "Paula"
  }

  function ExportGrid({ teacherKey, lessons, students }) {
    const timeSlots = useMemo(()=> range(toMinutes(START_HOUR), toMinutes(END_HOUR), SLOT_MIN), []);
    // helper: "Nombre Apellido"
    function shortOneSurname(fullName = '') {
      const parts = String(fullName).trim().split(/\s+/);
      if (!parts.length) return '';
      const name = parts[0];
      const connectors = new Set(['de','del','la','las','los','y','da','do','das','dos','du']);
      let surname = '';
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].toLowerCase();
        if (!connectors.has(p)) { surname = parts[i]; break; }
      }
      return surname ? `${name} ${surname}` : name;
    }

    return (
      <div className={styles.exportRoot}>
        <div className={styles.exportHeader}>
          Horario — {teacherKey === 'NURIA' ? 'Nuria' : 'Santi'}
        </div>

        {/* === Mismo layout que el tablero: izquierda días, arriba horas === */}
        <div
          className={styles.exportGridBoard}
          style={{ gridTemplateColumns: `140px repeat(${timeSlots.length}, 1fr)` }}
        >
          {/* Fila 1: cabecera de horas */}
          <div></div>
          {timeSlots.map(start => (
            <div key={`h-${start}`} className={styles.dayHeader}>
              {minutesToLabel(start)}
            </div>
          ))}

          {/* Filas: por cada día, una fila para ESTE profesor a lo largo de TODAS las horas */}
          {DAYS.map((d, di) => (
            <React.Fragment key={`day-${d.key}`}>
              {/* Celda fija izquierda: Día + Profe */}
              <div className={`${styles.dayHeader} ${styles.exportLeftHeader}`}>
                <div className={styles.exportLeftHeaderDay}>{weekDates[di].pretty}</div>
                <div className={styles.exportLeftHeaderTeacher}>
                  <span className={styles.teacherChip}>
                    {teacherKey === 'NURIA' ? 'Nuria' : 'Santi'}
                  </span>
                </div>
              </div>

              {/* Celdas del día a través de TODAS las horas */}
              {timeSlots.map(start => {
                const here = lessons.filter(
                  l => l.teacher === teacherKey && l.dayOfWeek === d.key && l.startMin === start
                );

                const hasConflict = here.some(ls => {
                  const st = students.find(s => s.id === ls.studentId);
                  if (!st) return false;
                  return (st.extras || []).some(ex =>
                    ex.dayOfWeek === ls.dayOfWeek &&
                    overlaps(ls.actualStartMin ?? ls.startMin, ls.actualDurMin ?? ls.durMin, ex.startMin, ex.durMin)
                  );
                });

                return (
                  <div
                    key={`${teacherKey}-${d.key}-${start}`}
                    className={`${styles.exportCell} ${teacherKey === 'NURIA' ? styles.exportCellNuria : styles.exportCellSanti}`}
                  >
                    {hasConflict && <div className={styles.exportConflict} />}
                    <div className={styles.exportStack}>
                      {here.map(ls => {
                        const st = students.find(s => s.id === ls.studentId);
                        const siblings = here.map(l => students.find(s => s.id === l.studentId));
                        const displayStart = ls.actualStartMin ?? ls.startMin;
                        const displayDur   = ls.actualDurMin ?? ls.durMin;

                        return (
                          <div
                            key={ls.id}
                            className={`${styles.exportEvent} ${teacherKey==='NURIA' ? styles.eventNuria : styles.eventSanti}`}
                          >
                            <div className={`${styles.exportEventName} ${hasConflict ? styles.conflictName : ''}`}>
                              {formatStudentName(st, siblings)}
                            </div>

                            {displayDur === 90 && (
                              <div className={styles.exportEventMeta}>
                                {minutesToLabel(displayStart)} · {displayDur}m
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }



  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className={styles.layout}>
        {/* Cabecera */}
        <div className={styles.header}>
          <div className={styles.title}><img src="/logo.png" alt="Edúcate" style={{ height:'85px', width:'auto'}}/></div>
          <div style={{ display: 'flex', gap: '8px'}}>
            <button className={styles.btnOutline}
              onClick={()=> setWeekStart(prev => addDays(prev, -7))}>
              <img src="/flechaI.png" alt="Semana anterior" style={{ height: '18px', width: '18px', display: 'block' }} />
            </button>

            <div className={styles.weekBadge}>
              Semana: {ddmmyy(weekStart)} — {ddmmyy(addDays(weekStart, 4))}
              {weekSaved && <span className={styles.savedPill}>Guardado</span>}
            </div>

            <button className={styles.btnOutline}
              onClick={()=> setWeekStart(prev => addDays(prev, +7))}>
              <img src="/flechaD.png" alt="Semana siguiente" style={{ height: '18px', width: '18px', display: 'block' }} />
            </button>

            <button className={styles.btnPrimaryGS}
                    onClick={async ()=>{
                      const w = toISODateLocal(weekStart);
                      const res = await fetch('/api/weeks', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ weekStart: w, saved: true })
                      });
                      if (res.ok) setWeekSaved(true);
                    }}>
              <img src="/guardar.png" alt="Guardar Semana" style={{ height: '34px', width: '34px', display: 'block' }} />
            </button>
            <button onClick={()=>exportTeacher('NURIA')} className={styles.btnOutlinePDF}>PDF Nuria</button>
            <button onClick={()=>exportTeacher('SANTI')} className={styles.btnOutlinePDF}>PDF Santi</button>
            <Link href={`/send?weekStart=${toISODateLocal(weekStart)}`} className={styles.btnPrimarySend}>
              <img src="/whatsapp.png" alt="Enviar horario" style={{ height: '34px', width: '34px', display: 'block' }} />
            </Link>
            <Link href="/students" className={styles.btnPrimaryBD}>
              <img src="/BD.png" alt="Base de datos" style={{ height: '34px', width: '34px', display: 'block' }} />
            </Link>
            <Link href="/receipts" className={styles.btnPrimaryRB}>
              <img src="/recibo.png" alt="Recibos" style={{ height: '34px', width: '34px', display: 'block' }} />
            </Link>
          </div>
        </div>

        {/* Panel izquierdo */}
        <div className={styles.leftPanel}>
          <div className={styles.searchRow}>
            <input
              value={textQ}
              onChange={e=>setTextQ(e.target.value)}
              placeholder="Buscar por nombre o curso..."
              className={styles.input}
            />
            <select value={group} onChange={e=>setGroup(e.target.value)} className={styles.select}>
              {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className={styles.listHeader}>Alumnos ({filtered.length})</div>
          <div className={styles.studentList}>
            {filtered.map(s => {
              const count = countsByStudent.get(s.id) || 0;
              return (
                <Draggable key={s.id} id={`student:${s.id}`}>
                  <div className={`${styles.studentCard} ${count>0 ? styles.assigned : ''}`}>
                    {count>0 && <span className={styles.assignedBadge}>{count}</span>}
                    <div className={styles.studentName}>{s.fullName}</div>
                    <div className={styles.studentMetaRow}>
                      <div className={styles.studentMeta}>
                        {s.course} <span className={styles.muted}>· {courseGroup(s.course)}</span>
                      </div>
                      {(() => {
                        const planned = plannedMinutesByStudent.get(s.id) || 0;
                        const plannedStr = formatHoursFromMinutes(planned);
                        const desiredStr = (s.desiredHours != null) ? `${s.desiredHours}h` : '—';
                        return (
                          <div className={styles.hoursBadgeInline}>
                            {plannedStr} / {desiredStr}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </Draggable>
              );
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div className={styles.rightPanel}>
          {anyConflict && (
            <div className={styles.warning}>
              ⚠️ Hay clases que chocan con extraescolares. Revisa los nombres en rojo.
            </div>
          )}

          <div className={styles.board}>
            <div className={styles.scheduleGrid} style={gridColsStyle}>
              {/* Fila 1: cabecera de horas */}
              <div></div>
              {timeSlots.map(start => (
                <div key={`h-${start}`} className={styles.dayHeader}>
                  {minutesToLabel(start)}
                </div>
              ))}

              {/* Filas: por cada día, una fila por profesor */}
              {DAYS.map((d, di) => (
                <React.Fragment key={`day-${d.key}`}>
                  {TEACHERS.map(t => (
                    <React.Fragment key={`row-${d.key}-${t.key}`}>
                      {/* Celda fija izquierda: Día + Profe */}
                      <div className={`${styles.dayHeader} ${styles.leftHeader}`}>
                        <div className={styles.leftHeaderDay}>{weekDates[di].pretty}</div>
                        <div className={styles.leftHeaderTeacher}>
                          <span className={styles.teacherChip}>{t.label}</span>
                        </div>
                      </div>

                      {/* Celdas de ese día/profe a lo largo de TODAS las horas */}
                      {timeSlots.map(start => (
                        <CellTeacher
                          key={`cell-${d.key}-${t.key}-${start}`}
                          dia={d.key}
                          inicioMin={start}
                          teacherKey={t.key}
                          className={t.key === 'NURIA' ? styles.rowNuria : styles.rowSanti}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* === Vistas ocultas para exportar a PDF === */}
      <div ref={exportRefNuria} className={styles.exportHidden}>
        <ExportGrid teacherKey="NURIA" lessons={lessons} students={students} />
      </div>
      <div ref={exportRefSanti} className={styles.exportHidden}>
        <ExportGrid teacherKey="SANTI" lessons={lessons} students={students} />
      </div>
      
    </DndContext>
);
}

