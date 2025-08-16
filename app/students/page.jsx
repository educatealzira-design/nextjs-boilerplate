'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './students.module.css';
import './globals.css';

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

function StudentForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() => initial || {
    fullName: '', phone: '', address: '', guardianName: '', guardianPhone: '',
    school: '', course: '', specialty: '', schoolSchedule: '', referralSource: '',
    desiredHours: '', extras: [], subjects: [],
  });

  function addSubject() {
    setForm(f => ({ ...f, subjects: [...(f.subjects||[]), { name: '' }] }));
  }
  function setSubject(i, v) {
    setForm(f => ({ ...f, subjects: f.subjects.map((s, idx) => idx === i ? { ...s, name: v } : s) }));
  }
  function removeSubject(i) {
    setForm(f => ({ ...f, subjects: f.subjects.filter((_, idx) => idx !== i) }));
 }


  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function addExtra() {
    setForm(f => ({ ...f, extras: [...(f.extras||[]), { label: '', dayOfWeek: 1, startMin: 17*60, durMin: 60 }] }));
  }
  function setExtra(i, k, v) { setForm(f => ({ ...f, extras: f.extras.map((e, idx) => idx === i ? { ...e, [k]: v } : e) })); }
  function removeExtra(i) { setForm(f => ({ ...f, extras: f.extras.filter((_, idx) => idx !== i) })); }

  async function save() {
    const payload = {
      ...form,
      desiredHours: form.desiredHours ? Number(form.desiredHours) : null,
      extras: (form.extras||[]).map(e => ({
        label: e.label,
        dayOfWeek: Number(e.dayOfWeek),
        startMin: Number(e.startMin),
        durMin: Number(e.durMin),
      })),
      subjects: (form.subjects||[]).map(s => ({ name: s.name })),
    };
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
            <label className={styles.label}>Nombre padre/madre/tutor</label>
            <input value={form.guardianName||''} onChange={e=>setField('guardianName', e.target.value)} className={styles.input}/>
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>Teléfono padre/madre/tutor</label>
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
            <label className={styles.label}>Horario escolar (texto)</label>
            <textarea value={form.schoolSchedule||''} onChange={e=>setField('schoolSchedule', e.target.value)} className={styles.textarea} rows={2} />
          </div>
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

            <div className={`${styles.formRow} ${styles.span2}`}>
            <div className={styles.rowHeader}>
                <label className={styles.label}>Asignaturas que quiere cursar</label>
                <button onClick={addSubject} className={styles.linkButton}>Añadir asignatura</button>
            </div>
            <div className={styles.subjectsList}>
                {(form.subjects||[]).map((s, i) => (
                <div key={i} className={styles.subjectRow}>
                    <input
                    placeholder="p. ej. Matemáticas"
                    value={s.name}
                    onChange={e=>setSubject(i, e.target.value)}
                    className={styles.input}
                    />
                    <button onClick={()=>removeSubject(i)} className={styles.btn}>✕</button>
                </div>
                ))}
            </div>
            </div>

          <div className={`${styles.formRow} ${styles.span2}`}>
            <div className={styles.rowHeader}>
              <label className={styles.label}>Actividades extraescolares</label>
              <button onClick={addExtra} className={styles.linkButton}>Añadir actividad</button>
            </div>
            <div className={styles.extrasList}>
              {(form.extras||[]).map((ex, i) => (
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
                  <div className={`${styles.col} ${styles.col3}`}>
                    <label className={styles.smallLabel}>Inicio (HH:MM)</label>
                    <input type="time" value={toHHMM(ex.startMin)} onChange={e=>setExtra(i,'startMin', toMinutes(e.target.value))} className={styles.input}/>
                  </div>
                  <div className={`${styles.col} ${styles.col2}`}>
                    <label className={styles.smallLabel}>Duración (min)</label>
                    <input type="number" min={15} step={15} value={ex.durMin} onChange={e=>setExtra(i,'durMin', Number(e.target.value))} className={styles.input}/>
                  </div>
                  <div className={`${styles.col} ${styles.col1}`}>
                    <button onClick={()=>removeExtra(i)} className={styles.btn}>✕</button>
                  </div>
                </div>
              ))}
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

  const courses = useMemo(() => Array.from(new Set(students.map(s => s.course))).sort(), [students]);

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
          <div><span className={styles.muted}>Tutor:</span> {s.guardianName || '—'}</div>
          <div><span className={styles.muted}>Tel tutor:</span> {s.guardianPhone || '—'}</div>
          <div><span className={styles.muted}>Colegio:</span> {s.school || '—'}</div>
          <div className={styles.span2}><span className={styles.muted}>Dirección:</span> {s.address || '—'}</div>
          <div className={styles.span2}><span className={styles.muted}>Horario escolar:</span> {s.schoolSchedule || '—'}</div>
          <div><span className={styles.muted}>Nos conoces por:</span> {s.referralSource || '—'}</div>
          <div><span className={styles.muted}>Horas deseadas:</span> {s.desiredHours ?? '—'}</div>

        </div>
        {(s.extras?.length > 0) && (
          <div className={styles.cardExtras}>
            <div className={styles.cardExtrasTitle}>Extraescolares</div>
            <ul className={styles.ul}>
              {s.extras.map(ex => (
                <li key={ex.id}>
                  {['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][ex.dayOfWeek]} · {String(Math.floor(ex.startMin/60)).padStart(2,'0')}:{String(ex.startMin%60).padStart(2,'0')} · {ex.durMin}m — {ex.label}
                </li>
              ))}
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
        </div>
    );
}

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Alumnos</h1>
          <p className={styles.subtitle}>Tarjetas con filtro por curso y búsqueda.</p>
          <Link href="/" className={styles.btnOutline} title="Volver al horario">← Volver al horario</Link>
        </div>
        <div className={styles.actions}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nombre, colegio, dirección..." className={styles.input}/>
          <select value={course} onChange={e=>setCourse(e.target.value)} className={styles.select}>
            <option value="">Todos los cursos</option>
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
