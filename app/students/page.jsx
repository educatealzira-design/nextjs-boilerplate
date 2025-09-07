'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './students.module.css';


const REFERRALS = [
  { value: 'AMIGOS', label: 'Amigos' },
  { value: 'COMPANEROS', label: 'Compañeros' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'OTRO', label: 'Otro' },
];

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

const DAY_LABEL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];


const SUBJECT_OPTIONS = [
  'Matemáticas','Física','Química','Castellano','Valenciano','Inglés','Primaria',
];

function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return Number(h) * 60 + Number(m || 0);
}
function toHHMM(mins) {
  const h = Math.floor((mins || 0) / 60);
  const m = (mins || 0) % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// devuelve [1..7] desde fromDay a toDay (sin envolver, se asume from<=to)
function daySpan(fromDay, toDay) {
  const from = Number(fromDay);
  const to = Number(toDay);
  if (to < from) return []; // no tramos invertidos
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// solape de intervalos [aStart,aEnd) con [bStart,bEnd)
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}


function StudentForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => initial || {
    fullName: '', phone: '', address: '', guardianName: '', guardianPhone: '',
    school: '', course: '', specialty: '', schoolBlocks: [], referralSource: '',
    desiredHours: '', extras: [], subjects: [], notes: '',
  });
  
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ----- ASIGNATURAS -----
  function toggleSubject(name) {
    setForm(f => {
      const picked = new Set((f.subjects||[]).map(s => s.name));
      if (picked.has(name)) {
        return { ...f, subjects: (f.subjects||[]).filter(s => s.name !== name) };
      }
      return { ...f, subjects: [...(f.subjects||[]), { name }] };
    });
  }

  // ----- EXTRAESCOLARES -----
  function addExtra() {
    setForm(f => ({ ...f, extras: [...(f.extras||[]), { label: '', dayOfWeek: 1, startMin: 17*60, endMin: 18*60}] }));
  }
  function setExtra(i, k, v) { setForm(f => ({ ...f, extras: f.extras.map((e, idx) => idx === i ? { ...e, [k]: v } : e) })); }
  function removeExtra(i) { setForm(f => ({ ...f, extras: f.extras.filter((_, idx) => idx !== i) })); }
  // Al editar un alumno existente, convierte durMin -> endMin para el formulario
  useEffect(() => {
    if (initial?.id) {
      setForm(f => ({
        ...f,
        extras: (initial.extras || []).map(e => ({
          ...e,
          endMin: Number(e.startMin) + Number(e.durMin || 0),
        })),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);


  // ----- HORARIO ESCOLAR -----
  function addSchoolBlock() {
    setForm(f => ({
      ...f,
      schoolBlocks: [
        ...(f.schoolBlocks || []),
        { fromDay: 1, toDay: 5, startMin: 8*60, endMin: 17*60 }
      ]
    }));
  }
  function setSchoolBlock(i, k, v) {
    setForm(f => ({
      ...f,
      schoolBlocks: f.schoolBlocks.map((b, idx) => idx === i ? { ...b, [k]: v } : b)
    }));
  }
  function removeSchoolBlock(i) {
    setForm(f => ({ ...f, schoolBlocks: f.schoolBlocks.filter((_, idx) => idx !== i) }));
  }

  // ----- VALIDACIONES -----
  function validateBeforeSave(payload) {
    // 1) coherencia de bloques escolares: from<=to y start<end
    for (const b of payload.schoolBlocks) {
      if (b.toDay < b.fromDay) {
        alert('En el horario escolar, el día final no puede ser anterior al inicial.');
        return false;
      }
      if (b.endMin <= b.startMin) {
        alert('En el horario escolar, la hora fin debe ser mayor que la de inicio.');
        return false;
      }
    }
    // 2) cada extraescolar no puede solapar con ningún tramo escolar
    for (const ex of payload.extras) {
      const exStart = ex.startMin;
      const exEnd = ex.startMin + ex.durMin;
      for (const b of payload.schoolBlocks) {
        const coveredDays = daySpan(b.fromDay, b.toDay);
        if (coveredDays.includes(ex.dayOfWeek)) {
          if (intervalsOverlap(exStart, exEnd, b.startMin, b.endMin)) {
            const msg = `La actividad "${ex.label||'Extraescolar'}" `
              + `(${DAY_LABEL[ex.dayOfWeek]} ${toHHMM(ex.startMin)}–${toHHMM(exEnd)}) `
              + `se solapa con el horario escolar (${DAY_LABEL[b.fromDay]}–${DAY_LABEL[b.toDay]} `
              + `${toHHMM(b.startMin)}–${toHHMM(b.endMin)}).`;
            alert(msg);
            return false;
          }
        }
      }
    }
    return true;
  }

  async function save() {
    const payload = {
      ...form,
      desiredHours: form.desiredHours ? Number(form.desiredHours) : null,
      // Convertimos endMin -> durMin para la API/BD
      extras: (form.extras||[]).map(e => {
        const start = Number(e.startMin);
        const end   = Number(e.endMin);
        const dur   = end - start;
        if (!(start >= 0) || !(end >= 0) || dur <= 0) {
          throw new Error('Cada extraescolar debe tener hora fin posterior a la hora inicio.');
        }
        return {
          label: e.label,
          dayOfWeek: Number(e.dayOfWeek),
          startMin: start,
          durMin: dur,
        };
      }),
      subjects: (form.subjects||[]).map(s => ({ name: s.name })),
      schoolBlocks: (form.schoolBlocks||[]).map(b => ({
        fromDay: Number(b.fromDay),
        toDay: Number(b.toDay),
        startMin: Number(b.startMin),
        endMin: Number(b.endMin),
      })),
    schoolSchedule: undefined,
    };
    if (!validateBeforeSave(payload)) return;
    const res = await fetch(initial?.id ? `/api/students/${initial.id}` : '/api/students', {
      method: initial?.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { alert('Error guardando'); return; }
    const data = await res.json();
    onSaved?.(data);
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{initial?.id ? 'Editar alumno' : 'Nuevo alumno'}</div>
          <button onClick={onCancel} className={styles.linkButton}>Cerrar</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.label}>Nombre y apellidos</label>
            <input value={form.fullName} onChange={e=>setField('fullName', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Teléfono</label>
            <input value={form.phone||''} onChange={e=>setField('phone', e.target.value)} className={styles.input}/>
          </div>
          <div className={`${styles.formRow} ${styles.span2}`}>
            <label className={styles.label}>Dirección</label>
            <input value={form.address||''} onChange={e=>setField('address', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Nombre padre/madre</label>
            <input value={form.guardianName||''} onChange={e=>setField('guardianName', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Teléfono padre/madre</label>
            <input value={form.guardianPhone||''} onChange={e=>setField('guardianPhone', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Colegio/Instituto</label>
            <input value={form.school||''} onChange={e=>setField('school', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Curso</label>
            <input value={form.course} onChange={e=>setField('course', e.target.value)} placeholder="p.ej. 3º ESO o 1º Bach" className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Especialidad (si es Bachiller)</label>
            <input value={form.specialty||''} onChange={e=>setField('specialty', e.target.value)} placeholder="Ciencias / Humanidades..." className={styles.input}/>
          </div>
          <div className={`${styles.formRow} ${styles.span2}`}>
            <label className={styles.label}>Comentario</label>
            <textarea
              rows={4}
              value={form.notes || ''}
              onChange={e => setField('notes', e.target.value)}
              className={styles.textarea}
              placeholder="Observaciones, disponibilidad especial, preferencias, etc."
            />
          </div>

          {/* HORARIO ESCOLAR NUEVO */}
          <div className={`${styles.formRow} ${styles.span2}`}>
            <div className={styles.rowHeader}>
              <label className={styles.label}>Horario escolar</label>
              <button onClick={addSchoolBlock} className={styles.linkButton}>Añadir tramo</button>
            </div>
            <div className={styles.extrasList}>
              {(form.schoolBlocks||[]).map((b, i) => (
                <div key={i} className={styles.extraRow}>
                  <div className={`${styles.col} ${styles.col3}`}>
                    <label className={styles.smallLabel}>De (día)</label>
                    <select value={b.fromDay} onChange={e=>setSchoolBlock(i,'fromDay', Number(e.target.value))} className={styles.select}>
                      {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className={`${styles.col} ${styles.col3}`}>
                    <label className={styles.smallLabel}>A (día)</label>
                    <select value={b.toDay} onChange={e=>setSchoolBlock(i,'toDay', Number(e.target.value))} className={styles.select}>
                      {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className={`${styles.col} ${styles.col2}`}>
                    <label className={styles.smallLabel}>Inicio (HH:MM)</label>
                    <input type="time" value={toHHMM(b.startMin)} onChange={e=>setSchoolBlock(i,'startMin', toMinutes(e.target.value))} className={styles.input}/>
                  </div>
                  <div className={`${styles.col} ${styles.col2}`}>
                    <label className={styles.smallLabel}>Fin (HH:MM)</label>
                    <input type="time" value={toHHMM(b.endMin)} onChange={e=>setSchoolBlock(i,'endMin', toMinutes(e.target.value))} className={styles.input}/>
                  </div>
                  <div className={`${styles.col} ${styles.col1}`}>
                    <button onClick={()=>removeSchoolBlock(i)} className={styles.btn}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ASIGNATURAS */}
          <div className={`${styles.formRow} ${styles.span2}`}>
            <label className={styles.label}>Asignaturas que quiere cursar</label>
            <div className={styles.subjectsChecklist}>
              {SUBJECT_OPTIONS.map(opt => {
                const checked = (form.subjects||[]).some(s => s.name === opt);
                return (
                  <label key={opt} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={()=>toggleSubject(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* “¿Cómo nos conoces?” y horas deseadas */}
          <div className={styles.formRow}>
            <label className={styles.label}>¿Cómo nos conoces?</label>
            <select value={form.referralSource||''} onChange={e=>setField('referralSource', e.target.value)} className={styles.select}>
              <option value="">— Selecciona —</option>
              {REFERRALS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.label}>Horas totales deseadas (semana)</label>
            <input
                type="number"
                min={0}
                step={1}
                value={form.desiredHours ?? ''}
                onChange={e=>setField('desiredHours', e.target.value)}
                className={styles.input}
            />
            </div>
            
          {/* EXTRAESCOLARES */}
          <div className={`${styles.formRow} ${styles.span2}`}>
            <div className={styles.rowHeader}>
              <label className={styles.label}>Actividades extraescolares</label>
              <button onClick={addExtra} className={styles.linkButton}>Añadir actividad</button>
            </div>
            <div className={styles.extrasList}>
              {(form.extras||[]).map((ex, i) => {
                const end = (Number(ex.endMin ?? Number(ex.startMin||0)+60));
                return (
                  <div key={i} className={styles.extraRow}>
                    <div className={`${styles.col} ${styles.col4}`}>
                      <label className={styles.smallLabel}>Actividad</label>
                      <input value={ex.label} onChange={e=>setExtra(i,'label', e.target.value)} className={styles.input}/>
                    </div>
                    <div className={`${styles.col} ${styles.col2}`}>
                      <label className={styles.smallLabel}>Día</label>
                      <select value={ex.dayOfWeek} onChange={e=>setExtra(i,'dayOfWeek', Number(e.target.value))} className={styles.select}>
                        {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div className={`${styles.col} ${styles.col2}`}>
                      <label className={styles.smallLabel}>Inicio (HH:MM)</label>
                      <input type="time" value={toHHMM(ex.startMin)} onChange={e=>setExtra(i,'startMin', toMinutes(e.target.value))} className={styles.input}/>
                    </div>
                    <div className={`${styles.col} ${styles.col2}`}>
                      <label className={styles.smallLabel}>Fin (HH:MM)</label>
                      <input type="time" value={toHHMM(end)} onChange={e=>setExtra(i,'endMin', toMinutes(e.target.value))} className={styles.input}/>
                    </div>
                    <div className={`${styles.col} ${styles.col1}`}>
                      <button onClick={()=>removeExtra(i)} className={styles.btn}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onCancel} className={styles.btn}>Cancelar</button>
          <button onClick={save} className={`${styles.btn} ${styles.btnPrimary}`}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [openForm, setOpenForm] = useState(null);

  async function load() {
    const url = new URL('/api/students', window.location.origin);
    if (q) url.searchParams.set('q', q);
    if (course) url.searchParams.set('course', course);
    const res = await fetch(url);
    const data = await res.json();
    setStudents(data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, course]);

  const courses = useMemo(() => Array.from(new Set(students.map(s => s.course))).filter(Boolean).sort(), [students]);

  async function onDelete(id) {
    if (!confirm('¿Eliminar alumno?')) return;
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    if (res.ok) setStudents(prev => prev.filter(s => s.id !== id));
  }

  function Card({ s }) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <div>
            <div className={styles.cardTitle}>{s.fullName}</div>
            <div className={styles.cardSubtitle}>{s.course}{s.specialty ? ` · ${s.specialty}` : ''}</div>
          </div>
          <div className={styles.cardActions}>
            <button onClick={()=>setOpenForm(s)} className={styles.linkButton}>Editar</button>
            <button onClick={()=>onDelete(s.id)} className={`${styles.linkButton} ${styles.danger}`}>Eliminar</button>
          </div>
        </div>
        <div className={styles.cardGrid}>
          <div><span className={styles.muted}>Tel:</span> {s.phone || '—'}</div>
          <div><span className={styles.muted}>Padre:</span> {s.guardianName || '—'}</div>
          <div><span className={styles.muted}>Tel Padre:</span> {s.guardianPhone || '—'}</div>
          <div><span className={styles.muted}>Colegio:</span> {s.school || '—'}</div>
          <div className={styles.span2}><span className={styles.muted}>Dirección:</span> {s.address || '—'}</div>
          {/* Render del horario escolar estructurado */}
          {(s.schoolBlocks?.length > 0) ? (
            <div className={styles.span2}>
              <span className={styles.muted}>Horario escolar:</span>{' '}
              <ul className={styles.ul} style={{marginTop: '0.25rem'}}>
                {s.schoolBlocks.map((b, idx) => (
                  <li key={b.id || idx}>
                    {DAY_LABEL[b.fromDay]}{b.fromDay!==b.toDay ? `–${DAY_LABEL[b.toDay]}` : ''} · {toHHMM(b.startMin)}–{toHHMM(b.endMin)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.span2}><span className={styles.muted}>Horario escolar:</span> —</div>
          )}
          <div><span className={styles.muted}>Nos conoces por:</span> {s.referralSource || '—'}</div>
          <div><span className={styles.muted}>Horas deseadas:</span> {s.desiredHours ?? '—'}</div>
        
        </div>
        {(s.extras?.length > 0) && (
          <div className={styles.cardExtras}>
            <div className={styles.cardExtrasTitle}>Extraescolares</div>
            <ul className={styles.ul}>
              {s.extras.map(ex => {
                const end = ex.startMin + ex.durMin;
                return (
                  <li key={ex.id || `${ex.dayOfWeek}-${ex.startMin}-${ex.durMin}`}>
                    {DAY_LABEL[ex.dayOfWeek]} · {toHHMM(ex.startMin)}–{toHHMM(end)} — {ex.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {(s.subjects?.length > 0) && (
            <div className={styles.cardExtras}>
                <div className={styles.cardExtrasTitle}>Asignaturas</div>
                <ul className={styles.ul}>
                {s.subjects.map(sub => <li key={sub.id}>{sub.name}</li>)}
                </ul>
            </div>
        )}
        {s.notes && (
          <div className={styles.span2}>
            <span className={styles.muted}>Comentario:</span> {s.notes}
          </div>
        )}
      </div>
    );
}

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Base de Datos Alumnos</div>
          <div style={{ display: 'flex', gap: '8px'}}>
            <Link href="/" className={styles.btnOutline}>← Volver al horario</Link>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nombre, colegio, dirección..." className={styles.input}/>
            <select value={course} onChange={e=>setCourse(e.target.value)} className={styles.select}>
              <option value="">Curso</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={()=>setOpenForm({})} className={`${styles.btn} ${styles.btnPrimary}`}>Nuevo alumno</button>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        {students.map(s => <Card key={s.id} s={s} />)}
      </div>

      {openForm && (
        <StudentForm
          initial={openForm.id ? openForm : null}
          onCancel={()=>setOpenForm(null)}
          onSaved={()=>{ setOpenForm(null); load(); }}
        />
      )}
    </div>
  );
}
