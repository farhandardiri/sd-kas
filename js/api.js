// ========================================
// MODUL GOOGLE SHEETS API
// ========================================

import { getAccessToken, isAuthenticated } from "./auth.js";

const getConfig = () => window.CONFIG;

export async function readSheet(sheetName, range = "A:Z") {
  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: getConfig().SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    return response.result.values || [];
  } catch (error) {
    console.error(`Error reading ${sheetName}:`, error);
    return [];
  }
}

export async function writeSheet(sheetName, range, values) {
  if (!isAuthenticated()) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }

  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: getConfig().SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: values },
    });
    return true;
  } catch (error) {
    console.error(`Error writing to ${sheetName}:`, error);
    alert("Gagal menyimpan data: " + error.message);
    return false;
  }
}

export async function appendSheet(sheetName, values) {
  if (!isAuthenticated()) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }

  try {
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: getConfig().SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      resource: { values: values },
    });
    return true;
  } catch (error) {
    console.error(`Error appending to ${sheetName}:`, error);
    alert("Gagal menambah data: " + error.message);
    return false;
  }
}

export async function deleteRow(sheetName, rowIndex) {
  if (!isAuthenticated()) {
    alert("Silakan login terlebih dahulu!");
    return false;
  }

  if (!confirm("Yakin ingin menghapus data ini?")) {
    return false;
  }

  try {
    // Get sheet ID
    const sheetMetadata = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: getConfig().SPREADSHEET_ID,
    });

    const sheet = sheetMetadata.result.sheets.find(
      (s) => s.properties.title === sheetName,
    );
    const sheetId = sheet.properties.sheetId;

    // Delete row
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: getConfig().SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting row from ${sheetName}:`, error);
    alert("Gagal menghapus data: " + error.message);
    return false;
  }
}
