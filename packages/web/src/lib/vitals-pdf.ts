import { VITAL_TYPES, type Vital } from '@nalvita/core';
import { jsPDF } from 'jspdf';

import { VITAL_STATUS_LABELS, VITAL_TYPE_LABELS, VITAL_UNITS, formatMeasuredAt, formatVitalValue, statusOf } from '@nalvita/data';

const MARGIN = 40;
const LINE_HEIGHT = 16;

/**
 * Builds a plain, printable summary of every reading grouped by type and
 * triggers a download. The file is generated in the browser and never leaves
 * the device, so it's safe to include the person's own health values.
 */
export function exportVitalsPdf(vitals: Vital[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const nextLine = (step = LINE_HEIGHT) => {
    y += step;
    if (y > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFontSize(18);
  doc.text('Nalvita — Vitals history', MARGIN, y);
  nextLine(LINE_HEIGHT + 4);
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, y);

  for (const type of VITAL_TYPES) {
    const readings = vitals
      .filter((v) => v.type === type)
      .sort((a, b) => b.measured_at.localeCompare(a.measured_at));
    if (readings.length === 0) continue;

    nextLine(LINE_HEIGHT * 2);
    doc.setFontSize(13);
    doc.text(`${VITAL_TYPE_LABELS[type]} (${VITAL_UNITS[type]})`, MARGIN, y);
    nextLine();
    doc.setFontSize(10);

    for (const reading of readings) {
      const parts = [
        formatMeasuredAt(reading.measured_at),
        formatVitalValue(reading),
        VITAL_STATUS_LABELS[statusOf(reading)],
        reading.notes ?? '',
      ];
      doc.text(parts.filter(Boolean).join('   ·   '), MARGIN, y);
      nextLine();
    }
  }

  doc.save(`nalvita-vitals-${new Date().toISOString().slice(0, 10)}.pdf`);
}
