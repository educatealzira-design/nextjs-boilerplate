// /lib/sheetsInvoices.js
import { getSheetsClient, SHEET_ID } from "./googleSheets";

export function tabNameForMonth(yearMonth) {
  return `Recibos ${yearMonth}`;
}

export const INV_HEADERS = [
  "Student ID",        // A
  "Mes (YYYY-MM)",     // B
  "Alumno",            // C
  "Curso",             // D
  "Teléfono",          // E
  "Tarifa (€/h)",      // F
  "Ajuste (min)",      // G
  "Total (min)",       // H
  "Importe (€)",       // I
  "Método",            // J
  "Estado",            // K  <<—— clave para formato condicional
  "Enviado el",        // L
  "Pagado el",         // M
  "Notas",             // N
];

function colLetter(idx1Based) {
  let s = "", n = idx1Based;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function invoiceToRow(inv) {
  const st = inv.student || {};
  return [
    inv.studentId,
    inv.yearMonth,
    st.fullName ?? "",
    st.course ?? "",
    st.phone ?? "",
    inv.rate ?? null,
    inv.adjustMin ?? 0,
    inv.totalMin ?? 0,
    inv.amount ?? 0,
    inv.paymentMethod ?? "",
    inv.status ?? "PENDIENTE",
    inv.sentAt ? new Date(inv.sentAt).toISOString() : "",
    inv.paidAt ? new Date(inv.paidAt).toISOString() : "",
    inv.notes ?? "",
  ];
}

async function ensureTabAndHeaders(sheets, tab) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  let sheet = (meta.data.sheets || []).find(s => s.properties?.title === tab);

  if (!sheet) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: tab, gridProperties: { rowCount: 5000, columnCount: 32 } } }
        }]
      }
    });
    sheet = addRes.data.replies?.[0]?.addSheet;
  }

  const endCol = colLetter(INV_HEADERS.length);
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1:${endCol}1`,
  });

  const row = head.data.values?.[0] || [];
  if (row.length !== INV_HEADERS.length || row.every(v => !v)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [INV_HEADERS] },
    });
  }

  // Aplica formatos de número básicos (moneda, enteros) y reglas condicionales
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const found = (sheetMeta.data.sheets || []).find(s => s.properties?.title === tab);
  const sheetId = found?.properties?.sheetId;
  if (sheetId) {
    await applyBaseFormatsAndRules(sheets, sheetId, tab);
  }
}

// ===== NUEVO: formatos y reglas condicionales (PENDIENTE / ENVIADO / PAGADO) =====
async function applyBaseFormatsAndRules(sheets, sheetId, tab) {
  const endColIndex = INV_HEADERS.length; // N = 14
  const endCol = colLetter(endColIndex);

  const requests = [
    // Formato de encabezados
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: endColIndex,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            horizontalAlignment: "LEFT",
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.98 },
          },
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)",
      },
    },
    // Formato de moneda para importe (columna I = index 8)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 8,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "CURRENCY", pattern: "€ #,##0.00" },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    // Enteros para minutos (G,H)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 6,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: "NUMBER", pattern: "0" },
            horizontalAlignment: "RIGHT",
          },
        },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    // Derecha para tarifa (F)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 5,
          endColumnIndex: 6,
        },
        cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(horizontalAlignment)",
      },
    },
    // ===== Reglas condicionales por ESTADO (columna K) en toda la tabla (A2:N)
    // PENDIENTE -> fondo suave amarillo
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: endColIndex }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$K2="PENDIENTE"` }] },
          },
        },
        index: 0,
      },
    },
    // ENVIADO -> fondo suave naranja
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: endColIndex }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$K2="ENVIADO"` }] },
            format: {
              backgroundColor: { red: 1.0, green: 0.92, blue: 0.84 },
            },
          },
        },
        index: 0,
      },
    },
    // PAGADO -> fondo verde muy suave + texto verde + (opcional) tachado
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: endColIndex }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=$K2="PAGADO"` }] },
            format: {
              backgroundColor: { red: 0.91, green: 0.98, blue: 0.93 },
              textFormat: { foregroundColor: { red: 0.12, green: 0.65, blue: 0.38 } },
            },
          },
        },
        index: 0,
      },
    },
  ];

  // Limpia reglas previas para evitar duplicados (opcional, seguro)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ deleteConditionalFormatRule: { sheetId, index: 0 } }] },
  }).catch(() => { /* puede fallar si no hay reglas */ });

  // Añade todas las reglas y formatos
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });
}

// ===================== API pública de este helper =====================

export async function upsertInvoiceRow(invoice) {
  const sheets = getSheetsClient();
  const tab = tabNameForMonth(invoice.yearMonth);

  await ensureTabAndHeaders(sheets, tab);

  const rowNum = await findRowByKey(sheets, tab, invoice.studentId, invoice.yearMonth);
  const values = [invoiceToRow(invoice)];
  const endCol = colLetter(INV_HEADERS.length);

  if (rowNum) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A${rowNum}:${endCol}${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  }
}

// Busca fila por clave (A=Student ID, B=Mes)
async function findRowByKey(sheets, tab, studentId, yearMonth) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A2:B`,
    majorDimension: "ROWS",
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const sid = (rows[i] || [])[0];
    const ym  = (rows[i] || [])[1];
    if (String(sid) === String(studentId) && String(ym) === String(yearMonth)) {
      return i + 2;
    }
  }
  return null;
}

// Exportar TODO un mes (clear + reescribir + formatos)
export async function rewriteMonthSheet(invoices, yearMonth) {
  const sheets = getSheetsClient();
  const tab = tabNameForMonth(yearMonth);
  await ensureTabAndHeaders(sheets, tab);

  const values = invoices.map(invoiceToRow);
  const endCol = colLetter(INV_HEADERS.length);

  // Limpia datos (pero deja cabecera)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A2:${endCol}`,
  });

  if (values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A2`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}
