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

/**
 * Construye las frases "lunes de 17:00 a 18:00 y jueves de 19:00 a 20:30"
 * usando actualStartMin/actualDurMin si existen; si no, startMin/durMin.
 */
export function buildSlotsText(lessonsForStudent){
  const items = lessonsForStudent
    .slice()
    .sort((a,b)=> a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin)
    .map(ls => {
      const start = (ls.actualStartMin ?? ls.startMin);
      const dur   = (ls.actualDurMin   ?? ls.durMin);
      const end   = start + dur;
      const dia   = DAY_LABEL[ls.dayOfWeek] ?? `día ${ls.dayOfWeek}`;
      const tag   = TEACHER_TAG[ls.teacher] || ''; // '' si no hay mapeo
      const tail  = tag ? ` ${tag}` : '';
      return `${dia} de ${minutesToHHMM(start)} a ${minutesToHHMM(end)}${tail}`;
    });

  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  // 3 o más: comas + "y" final
  return items.slice(0,-1).join(', ') + ' y ' + items.at(-1);
}

/**
 * Construye el mensaje final para WhatsApp.
 * Puedes ajustar el texto base a tu gusto.
 */
export function buildScheduleMessage(student, lessonsForStudent){
  const slots = buildSlotsText(lessonsForStudent);
  const nombre = firstName(student.fullName) || 'familia';
  if (!slots) {
    return
  }
  return `Hola ${nombre}, esta semana tienes clase ${slots}. Muchas gracias.`;
}
