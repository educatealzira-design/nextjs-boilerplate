// lib/scheduleText.js
const DAY_LABEL = {1:'lunes',2:'martes',3:'miércoles',4:'jueves',5:'viernes',6:'sábado',0:'domingo'};
const TEACHER_TAG = {
  NURIA: 'conmigo',
  SANTI: 'con Santi',
};

function minutesToHHMM(mins){
  const h = Math.floor(mins/60), m = mins%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function formatSlotTime(start, end) {
  if (end - start <= 60) return `a las ${minutesToHHMM(start)}`;
  return `de ${minutesToHHMM(start)} a ${minutesToHHMM(end)}`;
}

/**
 * Construye las frases "lunes a las 17:00 y jueves de 19:00 a 20:30"
 * usando actualStartMin/actualDurMin si existen; si no, startMin/durMin.
 */
export function buildSlotsText(lessonsForStudent){
  const sorted = lessonsForStudent
    .slice()
    .sort((a,b)=> a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);

  const items = sorted.map(ls => {
    const start = (ls.actualStartMin ?? ls.startMin);
    const dur   = (ls.actualDurMin   ?? ls.durMin);
    const end   = start + dur;
    const dia   = DAY_LABEL[ls.dayOfWeek] ?? `día ${ls.dayOfWeek}`;
    const tag   = TEACHER_TAG[ls.teacher] || '';
    const tail  = tag ? ` ${tag}` : '';
    return `${dia} ${formatSlotTime(start, end)}${tail}`;
  });

  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return items.slice(0,-1).join(', ') + ' y ' + items.at(-1);
}

/**
 * Construye el mensaje final para WhatsApp.
 * Con varios días usa formato de lista con viñetas.
 */
export function buildScheduleMessage(student, lessonsForStudent){
  const nombre = firstName(student.fullName) || 'familia';
  const sorted = lessonsForStudent
    .slice()
    .sort((a,b)=> a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);

  if (sorted.length === 0) return;

  if (sorted.length === 1) {
    const slots = buildSlotsText(sorted);
    return `Hola ${nombre}, esta semana tienes clase ${slots}. Muchas gracias.`;
  }

  // Varios días: formato lista
  const lines = sorted.map(ls => {
    const start = (ls.actualStartMin ?? ls.startMin);
    const dur   = (ls.actualDurMin   ?? ls.durMin);
    const end   = start + dur;
    const dia   = DAY_LABEL[ls.dayOfWeek] ?? `día ${ls.dayOfWeek}`;
    const tag   = TEACHER_TAG[ls.teacher] || '';
    const tail  = tag ? ` ${tag}` : '';
    return `* ${dia} ${formatSlotTime(start, end)}${tail}`;
  });

  return `Hola ${nombre}, esta semana tienes clase:\n${lines.join('\n')}\nMuchas gracias.`;
}
