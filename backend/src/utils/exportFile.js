const XLSX = require("xlsx");

// Sends `rows` (array of flat, already-labeled objects — keys become column headers) in the
// requested format. Reuses the `xlsx` package already used elsewhere on this platform for
// bulk-upload templates, so no new dependency for CSV/XLSX; JSON is just res.json.
function sendExport(res, { rows, filenameBase, format }) {
  const fmt = String(format || "csv").toLowerCase();

  if (fmt === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.json"`);
    return res.json(rows);
  }

  const ws = XLSX.utils.json_to_sheet(rows);

  if (fmt === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
    return res.send(buf);
  }

  const csv = XLSX.utils.sheet_to_csv(ws);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
  res.send(csv);
}

module.exports = { sendExport };
