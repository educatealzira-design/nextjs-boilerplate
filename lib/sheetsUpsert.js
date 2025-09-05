// /lib/sheetsUpsert.js
import prisma from "@/lib/prisma";
import { getSheetsClient, SHEET_ID, TAB } from "./googleSheets";

// +++ AÑADIMOS 2 COLUMNAS AL FINAL +++
export const HEADERS = [
  "ID",
  "Nombre completo",
  "Teléfono",
  "Dirección",
  "Tutor",
  "Tel. Tutor",
  "Colegio",
  "Curso",
  "Especialidad",
  "Horario colegio",
  "Fuente",
  "Horas deseadas",
  "Duración sesión (min)",
  "Precio/hora (€)",
  "Creado",
  "Actualizado",
  "Estado",        // <—— NUEVO
  "Eliminado el",  // <—— NUEVO
];

function studentToRow(s, { status = "Activo", deletedAt = "" } = {}) {
  return [
    s.id,
    s.fullName ?? "",
    s.phone ?? "",
    s.address ?? "",
    s.guardianName ?? "",
    s.guardianPhone ?? "",
    s.school ?? "",
    s.course ?? "",
    s.specialty ?? "",
    s.schoolSchedule ?? "",
    s.referralSource ?? "",
    s.desiredHours ?? null,
    s.sessionDurMin ?? null,
    s.billingRateEurHour ?? null,
    s.createdAt ? new Date(s.createdAt).toISOString() : "",
    s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
    status,       // "Activo" o "Eliminado"
    deletedAt,    // ISO string cuando se elimina
  ];
}

function colLetter(idx1Based) {
  // 1->A, 2->B, ... 26->Z, 27->AA, ...
  let s = "";
  let n = idx1Based;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Asegura pestaña y cabeceras
async function ensureTabAndHeaders(sheets) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  let sheet = (data.sheets || []).find((s) => s.properties?.title === TAB);
  if (!sheet) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 2000, columnCount: 40 } } } }] },
    });
    sheet = addRes.data.replies?.[0]?.addSheet;
  }

  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:${colLetter(HEADERS.length)}1`,
  });
  const firstRow = head.data.values?.[0] || [];
  // Si faltan columnas o está vacío, reescribimos headers completos
  if (firstRow.length !== HEADERS.length || firstRow.every((v) => !v)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

async function findRowByStudentId(sheets, studentId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A2:A`,
    majorDimension: "ROWS",
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i] || [])[0];
    if (String(cell) === String(studentId)) return i + 2;
  }
  return null;
}

export async function upsertStudentRow(student) {
  const sheets = getSheetsClient();
  await ensureTabAndHeaders(sheets);

  const rowNumber = await findRowByStudentId(sheets, student.id);
  const values = [studentToRow(student, { status: "Activo", deletedAt: "" })];
  const endCol = colLetter(HEADERS.length);

  if (rowNumber) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A${rowNumber}:${endCol}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }

  // autoajuste columnas (opcional)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === TAB);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: HEADERS.length },
            },
          },
        ],
      },
    });
  }
}

// NUEVO: marcar como eliminado (no borrar la fila)
export async function markStudentRowDeleted(studentId) {
  const sheets = getSheetsClient();
  await ensureTabAndHeaders(sheets);

  const rowNumber = await findRowByStudentId(sheets, studentId);
  if (!rowNumber) return; // si no existe, nada que marcar

  const endCol = colLetter(HEADERS.length);

  // 1) Leer fila actual completa
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A${rowNumber}:${endCol}${rowNumber}`,
  });
  const row = current.data.values?.[0] || [];
  // Asegurar longitud
  while (row.length < HEADERS.length) row.push("");

  // 2) Posiciones de Estado y Eliminado el
  const estadoIdx = HEADERS.indexOf("Estado");        // 0-based
  const eliminadoIdx = HEADERS.indexOf("Eliminado el");

  row[estadoIdx] = "Eliminado";
  row[eliminadoIdx] = new Date().toISOString();

  // 3) Escribir la fila completa de nuevo
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A${rowNumber}:${endCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  // 4) (Opcional) Formato visual: tachado + gris suave
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === TAB);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowNumber - 1, // 0-based
                endRowIndex: rowNumber,
                startColumnIndex: 0,
                endColumnIndex: HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { strikethrough: true },
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                },
              },
              fields: "userEnteredFormat(textFormat,strikethrough,backgroundColor)",
            },
          },
        ],
      },
    });
  }
}

// (Si lo necesitas en algún flujo) Upsert por id de DB
export async function upsertStudentRowById(studentId) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    include: { extras: true, subjects: true, schoolBlocks: true },
  });
  if (!s) throw new Error("Alumno no encontrado para upsert en Sheets");
  await upsertStudentRow(s);
}
