# Routine PDF dependencies

These pinned browser builds are served locally and loaded only when Download PDF is clicked.

- html2canvas 1.4.1: https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js
  - Documentation: https://html2canvas.hertzen.com/configuration
  - License: html2canvas-LICENSE.txt
- jsPDF 4.2.1: https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js
  - Source/releases: https://github.com/parallax/jsPDF/releases/tag/v4.2.1
  - License: jspdf-LICENSE.txt

The export uses the existing measured A4 print document as a high-resolution image, so fonts, merged cells, signature and seal share the print layout. PDF text is rasterized, not selectable.
