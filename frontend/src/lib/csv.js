/*
 * Génération de fichiers CSV lisibles par Excel en français :
 * séparateur « ; », décimales avec une virgule, BOM UTF-8 pour les accents.
 */

const SEPARATOR = ";";

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Injection de formule : un nom de client « =HYPERLINK(...) » ne doit pas
  // être exécuté par Excel. Les montants (nombres positifs) ne sont pas concernés.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  // Guillemets si la cellule contient le séparateur, un guillemet ou un retour à la ligne
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {Array<{ header: string, value: (row: any) => any }>} columns
 * @param {Array<any>} rows
 * @returns {string} contenu CSV (sans BOM)
 */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => escapeCell(c.header)).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(SEPARATOR));
  }
  return lines.join("\r\n");
}

/** Montant au format français : 1229.5 -> « 1229,50 » */
export function formatAmount(amount) {
  return (Number(amount) || 0).toFixed(2).replace(".", ",");
}

/** Déclenche le téléchargement du CSV dans le navigateur */
export function downloadCsv(filename, content) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
