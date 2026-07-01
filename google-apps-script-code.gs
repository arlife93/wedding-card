/*
  Google Apps Script for Wedding Wishes
  ใช้กับ index.html และ admin-wishes.html

  วิธีใช้:
  1) เปิด Google Sheet ใหม่
  2) Extensions > Apps Script
  3) วางโค้ดนี้
  4) แก้ ADMIN_KEY ให้ตรงกับ index.html/admin-wishes.html
  5) Deploy > New deployment > Web app
     - Execute as: Me
     - Who has access: Anyone
  6) Copy Web App URL ไปวางใน WISH_API_URL ของ index.html และ admin-wishes.html
*/

const SHEET_NAME = "Wishes";
const ADMIN_KEY = "CHANGE_THIS_ADMIN_KEY";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "list").toLowerCase();

  if (action === "list") {
    return handleList(e);
  }

  if (action === "clear") {
    return handleClear(e);
  }

  return jsonOutput({
    status: "error",
    message: "Unknown action"
  });
}

function doPost(e) {
  const action = String((e && e.parameter && e.parameter.action) || "submit").toLowerCase();

  if (action === "submit") {
    return handleSubmit(e);
  }

  return jsonOutput({
    status: "error",
    message: "Unknown action"
  });
}

function handleSubmit(e) {
  const sheet = getSheet();
  const p = e.parameter || {};

  const guestName = cleanText(p.guestName || p.name || "");
  const wishMessage = cleanText(p.wishMessage || p.guestWish || p.wish || "");

  if (!guestName || !wishMessage) {
    return jsonOutput({
      status: "error",
      message: "Missing guestName or wishMessage"
    });
  }

  sheet.appendRow([
    new Date(),
    guestName,
    wishMessage,
    String(p.source || "index.html")
  ]);

  return jsonOutput({
    status: "success"
  });
}

function handleList(e) {
  if (!isAdmin(e)) {
    return jsonOutput({
      status: "error",
      message: "Unauthorized"
    });
  }

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return jsonOutput({
      status: "success",
      data: []
    });
  }

  const data = values.slice(1)
    .filter(function(row) {
      return row[1] || row[2];
    })
    .map(function(row) {
      return {
        timestamp: row[0],
        guestName: row[1],
        wishMessage: row[2],
        source: row[3] || ""
      };
    });

  return jsonOutput({
    status: "success",
    data: data
  });
}

function handleClear(e) {
  if (!isAdmin(e)) {
    return jsonOutput({
      status: "error",
      message: "Unauthorized"
    });
  }

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  return jsonOutput({
    status: "success"
  });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeader(sheet);
  return sheet;
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Guest Name", "Wish", "Source"]);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, 4).getValues()[0];
  if (headers[0] !== "Timestamp" || headers[1] !== "Guest Name" || headers[2] !== "Wish") {
    sheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Guest Name", "Wish", "Source"]]);
  }
}

function isAdmin(e) {
  const key = String((e && e.parameter && e.parameter.key) || "");
  return key && key === ADMIN_KEY;
}

function cleanText(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 1500);
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
