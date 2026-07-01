/*
  A&M Wedding Wishes API
  Version: JSONP fixed for GitHub Pages / local HTML

  ใช้งาน:
  - index.html ส่งคำอวยพรด้วย GET action=submit
  - admin-wishes.html อ่านข้อมูลด้วย JSONP action=list
  - admin-wishes.html ลบข้อมูลด้วย JSONP action=clear

  หลังวางโค้ดนี้ใน Apps Script แล้วต้อง:
  Deploy > Manage deployments > Edit > Version: New version > Deploy
*/

const SHEET_NAME = "Wishes";
const ADMIN_KEY = "AM28072026";

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "list").toLowerCase();

  if (action === "submit") {
    return handleSubmit(e);
  }

  if (action === "list") {
    return handleList(e);
  }

  if (action === "clear") {
    return handleClear(e);
  }

  return output(e, {
    status: "error",
    message: "Unknown action"
  });
}

function doPost(e) {
  const action = String((e && e.parameter && e.parameter.action) || "submit").toLowerCase();

  if (action === "submit") {
    return handleSubmit(e);
  }

  return output(e, {
    status: "error",
    message: "Unknown action"
  });
}

function handleSubmit(e) {
  const sheet = getSheet();
  const p = (e && e.parameter) || {};

  const guestName = cleanText(p.guestName || p.name || "");
  const wishMessage = cleanText(p.wishMessage || p.guestWish || p.wish || "");

  if (!guestName || !wishMessage) {
    return output(e, {
      status: "error",
      message: "Missing guestName or wishMessage"
    });
  }

  sheet.appendRow([
    new Date(),
    guestName,
    wishMessage,
    cleanText(p.source || "index.html")
  ]);

  return output(e, {
    status: "success"
  });
}

function handleList(e) {
  if (!isAdmin(e)) {
    return output(e, {
      status: "error",
      message: "Unauthorized"
    });
  }

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return output(e, {
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

  return output(e, {
    status: "success",
    data: data
  });
}

function handleClear(e) {
  if (!isAdmin(e)) {
    return output(e, {
      status: "error",
      message: "Unauthorized"
    });
  }

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  return output(e, {
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

function output(e, obj) {
  const callback = cleanCallback((e && e.parameter && e.parameter.callback) || "");

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(obj) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanCallback(value) {
  const cb = String(value || "").trim();
  if (!cb) return "";
  return cb.replace(/[^a-zA-Z0-9_$\.]/g, "").slice(0, 120);
}
