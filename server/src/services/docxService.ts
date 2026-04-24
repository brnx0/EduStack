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
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { enrichDescriptions } from './aiService.js';

// Desabilita worker do pdfjs (não existe em Node.js)
// Aponta para o worker bundled do pdfjs-dist (necessário mesmo em Node.js)
const require = createRequire(import.meta.url);
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, '/')}`;

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

type ImageDimensions = { width: number; height: number };

function stripHtml(html: string): string {
	if (!html) return '';
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/li>/gi, '\n')
		.replace(/<li[^>]*>/gi, '• ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function detectFormat(buffer: Buffer): 'pdf' | 'png' | 'jpg' | 'unknown' {
	const hex = buffer.subarray(0, 4).toString('hex').toUpperCase();
	if (hex.startsWith('25504446')) return 'pdf';
	if (hex.startsWith('89504E47')) return 'png';
	if (hex.startsWith('FFD8FF')) return 'jpg';
	return 'unknown';
}

type PageImage = { buf: Buffer; width: number; height: number };

async function pdfToPages(pdfBuffer: Buffer): Promise<PageImage[]> {
	const pdf = await getDocument({
		data: new Uint8Array(pdfBuffer),
		useSystemFonts: true,
		isEvalSupported: false,
	}).promise;

	const pages: PageImage[] = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const viewport = page.getViewport({ scale: 1.5 }); // ~150 DPI
		const w = Math.floor(viewport.width);
		const h = Math.floor(viewport.height);

		const canvas = createCanvas(w, h);
		const ctx = canvas.getContext('2d');

		await page.render({ canvasContext: ctx as never, viewport, canvas: canvas as never }).promise;
		pages.push({ buf: canvas.toBuffer('image/png'), width: w, height: h });
	}

	return pages;
}

async function convertAttachment(attachment: AttachmentRow): Promise<PageImage[]> {
	const raw = attachment.UPR_ARQUIVO;
	const data: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as ArrayBuffer);

	const format = detectFormat(data);
	try {
		if (format === 'png' || format === 'jpg') {
			const img = await loadImage(data);
			const canvas = createCanvas(img.width, img.height);
			canvas.getContext('2d').drawImage(img, 0, 0);
			return [{ buf: canvas.toBuffer('image/png'), width: img.width, height: img.height }];
		}

		if (format === 'pdf') {
			return await pdfToPages(data);
		}

		console.warn(`[anexo ${attachment.UPR_COD}] formato desconhecido, ignorando.`);
	} catch (err) {
		console.error(`[anexo ${attachment.UPR_COD}] erro:`, err);
	}

	return [];
}

function headerRow(): TableRow {
	const cells = ['Card', 'Sprint', 'Solicitação', 'Descrição'].map((label) =>
		new TableCell({
			shading: { type: ShadingType.SOLID, color: '1d4ed8' },
			children: [
				new Paragraph({
					alignment: AlignmentType.CENTER,
					children: [new TextRun({ text: label, bold: true, color: 'FFFFFF', size: 20 })],
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
			children: [new Paragraph({ children: [new TextRun({ text: text ?? '', size: 18 })] })],
		});

	return new TableRow({
		children: [
			makeCell(String(cas.COD_CASO)),
			makeCell(`Sprint${cas.Sprint}`.trim()),
			makeCell(stripHtml(cas.CAS_RESUMO ?? '')),
			makeCell(stripHtml(description ?? cas.CAS_DESCRICAO ?? '')),
		],
	});
}

export async function createDocument(
	cases: CaseRow[],
	attachments: AttachmentRow[],
	sprintId: string,
): Promise<string> {
	const rawDescriptions = cases.map((c) => stripHtml(c.CAS_DESCRICAO ?? ''));
	const enriched = await enrichDescriptions(rawDescriptions);

	const casesTable = new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: [
			headerRow(),
			...cases.map((c, i) => caseRow(c, enriched[i] ?? c.CAS_DESCRICAO, i % 2 === 0)),
		],
	});

	const attachmentSections: (Paragraph | Table)[] = [];

	// Dimensões que cabem 2 imagens por página A4 sem distorcer
	const MAX_W = 440;
	const MAX_H = 420;

	for (const att of attachments) {
		const pages = await convertAttachment(att);

		if (pages.length > 0) {
			for (const [idx, page] of pages.entries()) {
				// Mantém proporção respeitando os dois limites
				const scaleByW = MAX_W / page.width;
				const scaleByH = MAX_H / page.height;
				const scale = Math.min(scaleByW, scaleByH);
				const dispW = Math.round(page.width * scale);
				const dispH = Math.round(page.height * scale);

				const label = pages.length > 1
					? `Card: ${att.COD_CASO}   |   Pág. ${idx + 1} / ${pages.length}`
					: `Card: ${att.COD_CASO}`;

				attachmentSections.push(
					new Paragraph({
						spacing: { before: 240, after: 60 },
						children: [new TextRun({ text: label, bold: true, size: 18, color: '1d4ed8' })],
					}),
					new Paragraph({
						alignment: AlignmentType.CENTER,
						spacing: { after: 200 },
						children: [
							new ImageRun({
								data: page.buf,
								transformation: { width: dispW, height: dispH },
								type: 'png',
							}),
						],
					}),
				);
			}
		} else {
			attachmentSections.push(
				new Paragraph({
					spacing: { before: 240, after: 60 },
					children: [new TextRun({ text: `Card: ${att.COD_CASO}`, bold: true, size: 18, color: '1d4ed8' })],
				}),
				new Paragraph({
					children: [new TextRun({ text: '[Anexo não pôde ser renderizado]', italics: true, color: '999999' })],
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
						children: [new TextRun({ text: 'ATESTO DE SPRINT', bold: true, size: 32, color: '1d4ed8' })],
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
