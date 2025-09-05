import prisma from "@/lib/prisma";
import { getSheetsClient, SHEET_ID, TAB } from "./googleSheets";

const HEADERS = [
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
];

export async function syncStudentsToSheet() {
  const sheets = getSheetsClient();

  const students = await prisma.student.findMany({
    orderBy: { createdAt: "asc" },
  });

  // 1) Limpiar pestaña
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:Z`,
  });

  // 2) Cabeceras
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });

  // 3) Datos
  const rows = students.map((s) => [
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
  ]);

  if (rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A2`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }

  // 4) Autoajustar columnas
  const sheetId = await getSheetIdByTitle(sheets, SHEET_ID, TAB);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: HEADERS.length,
            },
          },
        },
      ],
    },
  });

  return { count: students.length };
}

async function getSheetIdByTitle(sheets, spreadsheetId, title) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (data.sheets || []).find((s) => s.properties?.title === title);
  if (!sheet?.properties?.sheetId) {
    throw new Error(`No existe la pestaña "${title}"`);
  }
  return sheet.properties.sheetId;
}
