import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  HeadingLevel,
  ShadingType,
} from 'docx';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fromBuffer } from 'pdf2pic';
import { enrichDescriptions } from './aiService.js';

const TMP_DIR = path.join(os.tmpdir(), 'edustack');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

type CaseRow = {
  COD_CASO: number;
  CAS_RESUMO: string;
  Sprint: string;
  CAS_DESCRICAO: string;
};

type AttachmentRow = {
  COD_CASO: number;
  UPR_COD: number;
  UPR_ARQUIVO: Buffer;
};

function detectFormat(buffer: Buffer): 'pdf' | 'png' | 'jpg' | 'unknown' {
  const hex = buffer.subarray(0, 4).toString('hex').toUpperCase();
  if (hex.startsWith('25504446')) return 'pdf';
  if (hex.startsWith('89504E47')) return 'png';
  if (hex.startsWith('FFD8FF')) return 'jpg';
  return 'unknown';
}

async function convertAttachmentToBuffer(
  attachment: AttachmentRow,
): Promise<Buffer | null> {
  const format = detectFormat(attachment.UPR_ARQUIVO);

  if (format === 'png' || format === 'jpg') {
    return await sharp(attachment.UPR_ARQUIVO).png().toBuffer();
  }

  if (format === 'pdf') {
    const tmpPdf = path.join(TMP_DIR, `${attachment.UPR_COD}_input.pdf`);
    fs.writeFileSync(tmpPdf, attachment.UPR_ARQUIVO);

    try {
      const convert = fromBuffer(attachment.UPR_ARQUIVO, {
        density: 150,
        saveFilename: `${attachment.UPR_COD}`,
        savePath: TMP_DIR,
        format: 'png',
        width: 1200,
        height: 1600,
      });

      const pages = await convert.bulk(-1, { responseType: 'buffer' });
      const validPages = pages
        .filter((p) => p.buffer)
        .map((p) => p.buffer as Buffer);

      if (validPages.length === 0) return null;

      if (validPages.length === 1) {
        return await sharp(validPages[0]).png().toBuffer();
      }

      const images = await Promise.all(
        validPages.map((buf) => sharp(buf).metadata().then((meta) => ({ buf, meta }))),
      );

      const maxWidth = Math.max(...images.map((i) => i.meta.width ?? 0));
      const totalHeight = images.reduce((sum, i) => sum + (i.meta.height ?? 0), 0);

      const combined = sharp({
        create: {
          width: maxWidth,
          height: totalHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      });

      let offsetY = 0;
      const compositeOps = images.map(({ buf, meta }) => {
        const op = { input: buf, top: offsetY, left: 0 };
        offsetY += meta.height ?? 0;
        return op;
      });

      return await combined.composite(compositeOps).png().toBuffer();
    } catch (err) {
      console.error(`PDF conversion failed for attachment ${attachment.UPR_COD}:`, err);
      return null;
    } finally {
      if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    }
  }

  return null;
}

function headerRow(): TableRow {
  const cells = ['Card', 'Sprint', 'Solicitação', 'Descrição'].map((label) =>
    new TableCell({
      shading: { type: ShadingType.SOLID, color: '1d4ed8' },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: label,
              bold: true,
              color: 'FFFFFF',
              size: 20,
            }),
          ],
        }),
      ],
    }),
  );
  return new TableRow({ children: cells, tableHeader: true });
}

function caseRow(cas: CaseRow, description: string, isEven: boolean): TableRow {
  const bg = isEven ? 'F1F5F9' : 'FFFFFF';
  const makeCell = (text: string) =>
    new TableCell({
      shading: { type: ShadingType.SOLID, color: bg },
      children: [
        new Paragraph({
          children: [new TextRun({ text: text ?? '', size: 18 })],
        }),
      ],
    });

  return new TableRow({
    children: [
      makeCell(String(cas.COD_CASO)),
      makeCell(`Sprint${cas.Sprint}`.trim()),
      makeCell(cas.CAS_RESUMO ?? ''),
      makeCell(description ?? cas.CAS_DESCRICAO ?? ''),
    ],
  });
}

export async function createDocument(
  cases: CaseRow[],
  attachments: AttachmentRow[],
  sprintId: string,
): Promise<string> {
  const rawDescriptions = cases.map((c) => c.CAS_DESCRICAO ?? '');
  const enriched = await enrichDescriptions(rawDescriptions);

  const casesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow(),
      ...cases.map((c, i) => caseRow(c, enriched[i] ?? c.CAS_DESCRICAO, i % 2 === 0)),
    ],
  });

  const attachmentSections: (Paragraph | Table)[] = [];

  for (const att of attachments) {
    const imgBuffer = await convertAttachmentToBuffer(att);

    attachmentSections.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [
          new TextRun({
            text: `Card: ${att.COD_CASO}`,
            bold: true,
            size: 22,
          }),
        ],
        spacing: { before: 300, after: 100 },
      }),
    );

    if (imgBuffer) {
      const meta = await sharp(imgBuffer).metadata();
      const maxW = 600;
      const ratio = (meta.height ?? maxW) / (meta.width ?? maxW);
      const dispW = maxW;
      const dispH = Math.round(maxW * ratio);

      attachmentSections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imgBuffer,
              transformation: { width: dispW, height: dispH },
              type: 'png',
            }),
          ],
          spacing: { after: 200 },
        }),
      );
    } else {
      attachmentSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '[Anexo não pôde ser renderizado]',
              italics: true,
              color: '999999',
            }),
          ],
        }),
      );
    }
  }

  const today = new Date().toLocaleDateString('pt-BR');

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'ATESTO DE SPRINT',
                bold: true,
                size: 32,
                color: '1d4ed8',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: `Data: ${today}`, size: 20, color: '64748b' })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: 'Casos de Teste', bold: true })],
          }),
          casesTable,
          ...(attachmentSections.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 600, after: 200 },
                  children: [new TextRun({ text: 'Anexos', bold: true })],
                }),
                ...attachmentSections,
              ]
            : []),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(TMP_DIR, `Atesto_Final_${Date.now()}.docx`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}
