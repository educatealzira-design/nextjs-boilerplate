import { google } from "googleapis";

export function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
export const TAB = process.env.GOOGLE_SHEETS_TAB_NAME || "Alumnos";
