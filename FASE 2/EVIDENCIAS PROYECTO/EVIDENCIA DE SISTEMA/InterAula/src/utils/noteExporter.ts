import type { AcademicNote } from '../services/notes.service';

export interface StructuredBlock {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list-item' | 'ordered-item' | 'quote' | 'code' | 'math' | 'table-row' | 'divider';
  text: string;
}

function sanitizeFilename(title: string): string {
  const clean = (title || 'apunte-interaula')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return clean || 'apunte-interaula';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Convierte contenido HTML/Markdown de un apunte en bloques semánticos estructurados
 * preservando títulos, subtítulos, listas, bloques de código, fórmulas, citas y tablas.
 */
export function parseNoteToStructuredBlocks(html: string, fallbackMarkdown = ''): StructuredBlock[] {
  const source = (html || '').trim();
  if (!source && fallbackMarkdown.trim()) {
    return parseMarkdownToBlocks(fallbackMarkdown);
  }
  if (!source) {
    return [{ type: 'paragraph', text: 'Sin contenido adicional.' }];
  }

  // Normalizar cierres de etiquetas de bloque a saltos con marcadores semánticos
  const normalized = source
    .replace(/<hr\s*\/?>/gi, '\n@@BLOCK:DIVIDER@@\n')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n@@BLOCK:H1@@$1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n@@BLOCK:H2@@$1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n@@BLOCK:H3@@$1\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n@@BLOCK:QUOTE@@$1\n')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n@@BLOCK:CODE@@$1\n')
    .replace(/<div[^>]*data-math[^>]*>([\s\S]*?)<\/div>/gi, '\n@@BLOCK:MATH@@$1\n')
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m, rowInner: string) => {
      const cells = Array.from(rowInner.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((c) =>
        decodeHtmlEntities(c[1].replace(/<[^>]+>/g, '').trim())
      );
      return cells.length > 0 ? `\n@@BLOCK:TABLE@@${cells.join(' | ')}\n` : '\n';
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, listInner: string) => {
      let idx = 1;
      return listInner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_li, itemText: string) => {
        const line = `\n@@BLOCK:OLI@@${idx}. ${itemText}\n`;
        idx += 1;
        return line;
      });
    })
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, listInner: string) =>
      listInner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n@@BLOCK:ULI@@$1\n')
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n@@BLOCK:ULI@@$1\n')
    .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');

  const lines = normalized.split('\n');
  const blocks: StructuredBlock[] = [];

  for (const rawLine of lines) {
    const cleanText = (prefix: string) =>
      decodeHtmlEntities(rawLine.slice(prefix.length).replace(/<[^>]+>/g, '').trim());

    if (rawLine.startsWith('@@BLOCK:DIVIDER@@')) {
      blocks.push({ type: 'divider', text: '------------------------------------------------------------' });
    } else if (rawLine.startsWith('@@BLOCK:H1@@')) {
      const t = cleanText('@@BLOCK:H1@@');
      if (t) blocks.push({ type: 'h1', text: t });
    } else if (rawLine.startsWith('@@BLOCK:H2@@')) {
      const t = cleanText('@@BLOCK:H2@@');
      if (t) blocks.push({ type: 'h2', text: t });
    } else if (rawLine.startsWith('@@BLOCK:H3@@')) {
      const t = cleanText('@@BLOCK:H3@@');
      if (t) blocks.push({ type: 'h3', text: t });
    } else if (rawLine.startsWith('@@BLOCK:QUOTE@@')) {
      const t = cleanText('@@BLOCK:QUOTE@@');
      if (t) blocks.push({ type: 'quote', text: `"${t}"` });
    } else if (rawLine.startsWith('@@BLOCK:CODE@@')) {
      const t = cleanText('@@BLOCK:CODE@@');
      if (t) blocks.push({ type: 'code', text: t });
    } else if (rawLine.startsWith('@@BLOCK:MATH@@')) {
      const t = cleanText('@@BLOCK:MATH@@');
      if (t) blocks.push({ type: 'math', text: `Formula: ${t}` });
    } else if (rawLine.startsWith('@@BLOCK:TABLE@@')) {
      const t = cleanText('@@BLOCK:TABLE@@');
      if (t) blocks.push({ type: 'table-row', text: `| ${t} |` });
    } else if (rawLine.startsWith('@@BLOCK:OLI@@')) {
      const t = cleanText('@@BLOCK:OLI@@');
      if (t) blocks.push({ type: 'ordered-item', text: t });
    } else if (rawLine.startsWith('@@BLOCK:ULI@@')) {
      const t = cleanText('@@BLOCK:ULI@@');
      if (t) blocks.push({ type: 'list-item', text: `• ${t}` });
    } else {
      const t = decodeHtmlEntities(rawLine.replace(/<[^>]+>/g, '').trim());
      if (t) blocks.push({ type: 'paragraph', text: t });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', text: 'Sin contenido adicional.' }];
}

function parseMarkdownToBlocks(md: string): StructuredBlock[] {
  const lines = md.split(/\r?\n/);
  const blocks: StructuredBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'list-item', text: `• ${trimmed.slice(2)}` });
    } else if (/^\d+\.\s+/.test(trimmed)) {
      blocks.push({ type: 'ordered-item', text: trimmed });
    } else if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', text: trimmed.slice(2) });
    } else if (trimmed === '---' || trimmed === '***') {
      blocks.push({ type: 'divider', text: '------------------------------------------------------------' });
    } else {
      blocks.push({ type: 'paragraph', text: trimmed });
    }
  }
  return blocks;
}

/**
 * Convierte HTML rico en Markdown limpio y bien estructurado.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '_$1_')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  md = decodeHtmlEntities(md)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return md;
}

function escapePdfText(input: string): string {
  // Mapea caracteres latinos comunes a WinAnsi / Latin-1 octal o equivalentes seguros en PDF estándar
  const normalized = input
    .replace(/•/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—|–/g, '-');

  let out = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    const ch = normalized[i];
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += `\\${ch}`;
    } else if (code >= 32 && code <= 126) {
      out += ch;
    } else if (code >= 160 && code <= 255) {
      out += `\\${code.toString(8).padStart(3, '0')}`;
    } else {
      out += '?';
    }
  }
  return out;
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Genera un documento PDF vectorial multipágina real (%PDF-1.4) con jerarquía tipográfica
 * (Helvetica, Helvetica-Bold, Courier), márgenes académicos, paginación y metadatos.
 * No es una captura de pantalla de la interfaz.
 */
export function generateStructuredPdfBytes(note: Partial<AcademicNote>): Uint8Array {
  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const marginX = 52;
  const topY = pageHeight - 56;
  const bottomY = 58;

  const blocks = parseNoteToStructuredBlocks(note.contentHtml || '', note.contentMarkdown || '');

  interface RenderInstruction {
    font: 'F1' | 'F2' | 'F3'; // F1: Helvetica, F2: Helvetica-Bold, F3: Courier
    size: number;
    indent: number;
    text: string;
    spacingBefore: number;
    spacingAfter: number;
    colorGray?: number;
  }

  const instructions: RenderInstruction[] = [
    {
      font: 'F2',
      size: 9,
      indent: 0,
      text: `INTERAULA · BIBLIOTECA ACADEMICA · ${(note.category || 'APUNTE').toUpperCase()}`,
      spacingBefore: 0,
      spacingAfter: 6,
      colorGray: 0.35,
    },
    {
      font: 'F2',
      size: 18,
      indent: 0,
      text: note.title || 'Apunte Académico Sin Título',
      spacingBefore: 2,
      spacingAfter: 8,
      colorGray: 0.05,
    },
    {
      font: 'F1',
      size: 9.5,
      indent: 0,
      text: `Asignatura: ${note.subjectName || 'General'}  |  Carrera: ${note.career || 'Ingeniería'}  |  Autor: ${note.authorName || 'Estudiante'}`,
      spacingBefore: 0,
      spacingAfter: 4,
      colorGray: 0.3,
    },
    {
      font: 'F1',
      size: 9,
      indent: 0,
      text: `Fecha: ${new Date(note.updatedAt || Date.now()).toLocaleDateString('es-CL')}  |  Versión: v${note.version || 1}  |  Etiquetas: ${(note.tags || []).join(', ') || 'General'}`,
      spacingBefore: 0,
      spacingAfter: 10,
      colorGray: 0.4,
    },
    {
      font: 'F1',
      size: 9,
      indent: 0,
      text: '_____________________________________________________________________________________',
      spacingBefore: 0,
      spacingAfter: 14,
      colorGray: 0.65,
    },
  ];

  if (note.summary && note.summary.trim()) {
    for (const line of wrapLine(`Resumen: ${note.summary.trim()}`, 82)) {
      instructions.push({
        font: 'F2',
        size: 10.5,
        indent: 0,
        text: line,
        spacingBefore: 0,
        spacingAfter: 4,
        colorGray: 0.2,
      });
    }
    instructions.push({
      font: 'F1',
      size: 8,
      indent: 0,
      text: '',
      spacingBefore: 0,
      spacingAfter: 8,
    });
  }

  for (const block of blocks) {
    if (block.type === 'h1') {
      for (const line of wrapLine(block.text, 62)) {
        instructions.push({
          font: 'F2',
          size: 15,
          indent: 0,
          text: line,
          spacingBefore: 10,
          spacingAfter: 6,
          colorGray: 0.08,
        });
      }
    } else if (block.type === 'h2') {
      for (const line of wrapLine(block.text, 68)) {
        instructions.push({
          font: 'F2',
          size: 13,
          indent: 0,
          text: line,
          spacingBefore: 8,
          spacingAfter: 5,
          colorGray: 0.12,
        });
      }
    } else if (block.type === 'h3') {
      for (const line of wrapLine(block.text, 74)) {
        instructions.push({
          font: 'F2',
          size: 11.5,
          indent: 0,
          text: line,
          spacingBefore: 6,
          spacingAfter: 4,
          colorGray: 0.15,
        });
      }
    } else if (block.type === 'code' || block.type === 'math') {
      for (const line of wrapLine(block.text, 74)) {
        instructions.push({
          font: 'F3',
          size: 9.5,
          indent: 14,
          text: line,
          spacingBefore: 2,
          spacingAfter: 3,
          colorGray: 0.15,
        });
      }
    } else if (block.type === 'quote') {
      for (const line of wrapLine(block.text, 78)) {
        instructions.push({
          font: 'F1',
          size: 10.5,
          indent: 16,
          text: line,
          spacingBefore: 2,
          spacingAfter: 4,
          colorGray: 0.28,
        });
      }
    } else if (block.type === 'list-item' || block.type === 'ordered-item') {
      for (const line of wrapLine(block.text, 80)) {
        instructions.push({
          font: 'F1',
          size: 10.5,
          indent: 12,
          text: line,
          spacingBefore: 1,
          spacingAfter: 3,
          colorGray: 0.12,
        });
      }
    } else if (block.type === 'table-row') {
      for (const line of wrapLine(block.text, 76)) {
        instructions.push({
          font: 'F3',
          size: 9.5,
          indent: 6,
          text: line,
          spacingBefore: 1,
          spacingAfter: 2,
          colorGray: 0.15,
        });
      }
    } else if (block.type === 'divider') {
      instructions.push({
        font: 'F1',
        size: 9,
        indent: 0,
        text: '-------------------------------------------------------------------------------------',
        spacingBefore: 6,
        spacingAfter: 6,
        colorGray: 0.6,
      });
    } else {
      for (const line of wrapLine(block.text, 84)) {
        instructions.push({
          font: 'F1',
          size: 10.5,
          indent: 0,
          text: line,
          spacingBefore: 0,
          spacingAfter: 4,
          colorGray: 0.12,
        });
      }
    }
  }

  // Paginar instrucciones
  const pagesStreams: string[] = [];
  let currentOps: string[] = [];
  let cursorY = topY;

  const flushPage = (pageNum: number) => {
    currentOps.push(
      `BT /F1 8.5 Tf 0.45 g ${marginX} 34 Td (InterAula · Documento Academico Estructurado · Pagina ${pageNum}) Tj ET`
    );
    pagesStreams.push(currentOps.join('\n'));
    currentOps = [];
    cursorY = topY;
  };

  for (const inst of instructions) {
    const lineHeight = inst.size * 1.32;
    if (cursorY - inst.spacingBefore - lineHeight < bottomY) {
      flushPage(pagesStreams.length + 1);
    }
    cursorY -= inst.spacingBefore + lineHeight;
    const x = marginX + inst.indent;
    const gray = inst.colorGray ?? 0.1;
    const escaped = escapePdfText(inst.text);
    currentOps.push(
      `BT /${inst.font} ${inst.size.toFixed(1)} Tf ${gray.toFixed(2)} g ${x.toFixed(1)} ${cursorY.toFixed(1)} Td (${escaped}) Tj ET`
    );
    cursorY -= inst.spacingAfter;
  }

  if (currentOps.length > 0 || pagesStreams.length === 0) {
    flushPage(pagesStreams.length + 1);
  }

  // Ensamblar objetos PDF (%PDF-1.4 con soporte WinAnsiEncoding para tildes y eñes)
  const objects: string[] = [];
  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Obj 2: Pages placeholder
  objects.push('');
  // Obj 3, 4, 5: Fonts
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj'
  );

  const pageObjectIds: number[] = [];
  for (const streamContent of pagesStreams) {
    const pageObjId = objects.length + 1;
    const contentObjId = objects.length + 2;
    pageObjectIds.push(pageObjId);

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>\nendobj`;

  let pdfBody = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdfBody.length);
    pdfBody += `${obj}\n`;
  }

  const xrefOffset = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfBody += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdfBody.length);
  for (let i = 0; i < pdfBody.length; i += 1) {
    bytes[i] = pdfBody.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * 1. Exportar Apunte a PDF Real Estructurado (.pdf)
 */
export function exportNoteToPdf(note: Partial<AcademicNote>): Uint8Array {
  const pdfBytes = generateStructuredPdfBytes(note);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  triggerBrowserDownload(blob, `${sanitizeFilename(note.title || 'apunte')}.pdf`);
  return pdfBytes;
}

/**
 * 2. Exportar Apunte a Formato Nativo Editable de InterAula (.interaula.json)
 */
export function exportNoteToInterAulaFormat(note: Partial<AcademicNote>): string {
  const payload = {
    schema: 'interaula.academic-note.v1',
    exportedAt: new Date().toISOString(),
    note: {
      title: note.title || 'Apunte sin título',
      summary: note.summary || '',
      subjectName: note.subjectName || 'General',
      career: note.career || 'Ingeniería en Informática',
      category: note.category || 'Apunte de Clase',
      folder: note.folder || 'General',
      tags: note.tags || [],
      contentHtml: note.contentHtml || '',
      contentMarkdown: note.contentMarkdown || htmlToMarkdown(note.contentHtml || ''),
      contentJson: note.contentJson || {},
      version: note.version || 1,
    },
  };
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, `${sanitizeFilename(note.title || 'apunte')}.interaula.json`);
  return jsonString;
}

/**
 * Importa un archivo .interaula.json de vuelta al Editor Integrado de InterAula.
 */
export function parseInterAulaNoteFile(rawJson: string): Partial<AcademicNote> {
  const parsed = JSON.parse(rawJson);
  if (!parsed || parsed.schema !== 'interaula.academic-note.v1' || !parsed.note) {
    throw new Error('El archivo no corresponde a un formato válido de apunte InterAula (.interaula.json)');
  }
  return parsed.note;
}

/**
 * 3. Exportar Apunte a Markdown (.md)
 */
export function exportNoteToMarkdown(note: Partial<AcademicNote>): string {
  const bodyMd = note.contentMarkdown?.trim() || htmlToMarkdown(note.contentHtml || '');
  const fullMd = [
    `# ${note.title || 'Apunte Académico'}`,
    '',
    `> **Asignatura:** ${note.subjectName || 'General'} | **Carrera:** ${note.career || 'Ingeniería'} | **Categoría:** ${note.category || 'Apunte'}`,
    `> **Autor:** ${note.authorName || 'Estudiante'} | **Actualizado:** ${new Date(note.updatedAt || Date.now()).toLocaleDateString('es-CL')}`,
    note.summary ? `\n**Resumen:** ${note.summary}\n` : '',
    '---',
    '',
    bodyMd,
    '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8' });
  triggerBrowserDownload(blob, `${sanitizeFilename(note.title || 'apunte')}.md`);
  return fullMd;
}

/**
 * 4. Exportar Apunte a Texto Plano Estructurado (.txt)
 */
export function exportNoteToPlainText(note: Partial<AcademicNote>): string {
  const blocks = parseNoteToStructuredBlocks(note.contentHtml || '', note.contentMarkdown || '');
  const lines: string[] = [
    '======================================================================',
    (note.title || 'APUNTE ACADEMICO INTERAULA').toUpperCase(),
    '======================================================================',
    `Asignatura : ${note.subjectName || 'General'}`,
    `Carrera    : ${note.career || 'Ingeniería'}`,
    `Categoría  : ${note.category || 'Apunte de Clase'}`,
    `Autor      : ${note.authorName || 'Estudiante'}`,
    `Fecha      : ${new Date(note.updatedAt || Date.now()).toLocaleDateString('es-CL')}`,
    '----------------------------------------------------------------------',
    '',
  ];

  if (note.summary) {
    lines.push(`RESUMEN: ${note.summary}`, '');
  }

  for (const b of blocks) {
    if (b.type === 'h1') {
      lines.push('', b.text.toUpperCase(), '='.repeat(Math.min(60, b.text.length)));
    } else if (b.type === 'h2') {
      lines.push('', b.text, '-'.repeat(Math.min(50, b.text.length)));
    } else if (b.type === 'h3') {
      lines.push('', `[ ${b.text} ]`);
    } else {
      lines.push(b.text);
    }
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerBrowserDownload(blob, `${sanitizeFilename(note.title || 'apunte')}.txt`);
  return content;
}

/**
 * 5. Exportar Apunte a Documento Word Compatible (.doc)
 */
export function exportNoteToWordDoc(note: Partial<AcademicNote>): string {
  const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="es">
<head>
  <meta charset="utf-8" />
  <title>${note.title || 'Apunte Académico'}</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; color: #0f172a; line-height: 1.6; margin: 2.2cm; }
    h1 { font-size: 22pt; color: #1e3a8a; margin-bottom: 6pt; }
    h2 { font-size: 16pt; color: #1e40af; margin-top: 16pt; margin-bottom: 6pt; }
    h3 { font-size: 13pt; color: #334155; margin-top: 12pt; margin-bottom: 4pt; }
    .meta { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10pt; margin-bottom: 16pt; font-size: 10pt; color: #475569; }
    blockquote { border-left: 3pt solid #2563eb; padding-left: 10pt; color: #334155; font-style: italic; }
    pre, code { font-family: 'Consolas', 'Courier New', monospace; background: #f1f5f9; padding: 6pt; border-radius: 4pt; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
    th, td { border: 1px solid #94a3b8; padding: 6pt 8pt; text-align: left; }
    th { background: #eff6ff; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${note.title || 'Apunte Académico'}</h1>
  <div class="meta">
    <strong>Asignatura:</strong> ${note.subjectName || 'General'} &nbsp;|&nbsp;
    <strong>Carrera:</strong> ${note.career || 'Ingeniería'} &nbsp;|&nbsp;
    <strong>Categoría:</strong> ${note.category || 'Apunte'}<br/>
    <strong>Autor:</strong> ${note.authorName || 'Estudiante'} &nbsp;|&nbsp;
    <strong>Fecha:</strong> ${new Date(note.updatedAt || Date.now()).toLocaleDateString('es-CL')}
    ${note.summary ? `<br/><strong>Resumen:</strong> ${note.summary}` : ''}
  </div>
  <div>
    ${note.contentHtml || `<p>${(note.contentMarkdown || '').replace(/\n/g, '<br/>')}</p>`}
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
  triggerBrowserDownload(blob, `${sanitizeFilename(note.title || 'apunte')}.doc`);
  return docHtml;
}
