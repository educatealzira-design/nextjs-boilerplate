'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './send.module.css';

function waLink(phone, text){
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default function SendPage(){
  const [data, setData] = useState({ range:'current', items: [] });
  const [q, setQ] = useState('');
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);

  useEffect(()=>{
    fetch('/api/messages')
      .then(r=>r.json())
      .then(setData)
      .catch(()=>setData({ range:'current', items: [] }));
  }, []);

  const filtered = useMemo(()=>{
    const t = q.toLowerCase();
    return data.items.filter(it=>{
      if (onlyWithPhone && !it.phone) return false;
      return (it.fullName||'').toLowerCase().includes(t);
    });
  }, [data, q, onlyWithPhone]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Enviar horario por WhatsApp</h1>
          <p className={styles.subtitle}>Previsualiza y abre WhatsApp Web con el mensaje listo por alumno.</p>
          <div className={styles.row}>
            <Link href="/" className={styles.btnOutline}>← Volver al horario</Link>
            <Link href="/whatsapp" className={styles.btnOutline}>WhatsApp (buscador)</Link>
            <a href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>
              Abrir WhatsApp Web
            </a>
          </div>
        </div>
        <div className={styles.actions}>
          <input className={styles.input} placeholder="Buscar alumno..." value={q} onChange={e=>setQ(e.target.value)} />
          <label className={styles.chk}>
            <input type="checkbox" checked={onlyWithPhone} onChange={e=>setOnlyWithPhone(e.target.checked)} />
            Sólo con teléfono
          </label>
        </div>
      </div>

      <div className={styles.toolbar}>
        {/* Lugar para un futuro: botón “Enviar automáticamente (Cloud API)” */}
        <button className={styles.btnDisabled} disabled>Enviar automáticamente (pronto)</button>
        <span className={styles.muted}>
          {filtered.length} mensajes listos
        </span>
      </div>

      <div className={styles.grid}>
        {filtered.map(it=>{
          const link = waLink(it.phone, it.text);
          return (
            <div key={it.studentId} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.name}>{it.fullName}</div>
                  <div className={styles.meta}>
                    {it.phone ? `📱 ${it.phone}` : '— sin teléfono —'} · {it.count} clase(s)
                  </div>
                </div>
                {link
                  ? <a href={link} target="_blank" rel="noopener noreferrer" className={styles.btnPrimary}>Abrir chat</a>
                  : <button className={styles.btnDisabled} disabled>Sin teléfono</button>
                }
              </div>
              <div className={styles.preview}>{it.text}</div>
              <button
                className={styles.btnCopy}
                onClick={async ()=>{
                  try { await navigator.clipboard.writeText(it.text); alert('Copiado'); }
                  catch { alert('No se pudo copiar'); }
                }}
              >Copiar texto</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
