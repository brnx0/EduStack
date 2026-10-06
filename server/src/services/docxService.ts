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
	ShadingType,
	BorderStyle,
	Header,
	Footer,
	PageNumber,
	PageBreak,
	VerticalAlign,
	HorizontalPositionRelativeFrom,
	VerticalPositionRelativeFrom,
	HighlightColor,
} from 'docx';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Funciona tanto em src/services (tsx) quanto em dist/services (build).
const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/atesto');

// ── Dados fixos do modelo ────────────────────────────────────────────────────
const EMPRESA_ENDERECO = 'Avenida da França, nº. 393, 2º andar – Comércio – Salvador – Ba – CEP: 40.010-000';
const EMPRESA_CNPJ = 'CNPJ: 09.543.618/0001-72';
const CONTRATADA = 'CONSORCIO ASTEC, CNPJ 46.460.782/0001-42';
const CONTRATANTE = 'Prefeitura Municipal do Salvador – PMS';
const CIDADE = 'Salvador-BA';
const ENTREGA_PLACEHOLDER = '[00]ª entrega';

// ── Estilo ───────────────────────────────────────────────────────────────────
const FONT = 'Calibri';
const TABLE_FONT = 'Arial';
const COLOR_HEADING = '002060';
const COLOR_TABLE_HEADER = '1F497D';

// A4 em twips / pixels (96 dpi) e EMU por ponto
const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;
const EMU_PER_PT = 12700;

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

export type AtestoInfo = {
	projectName: string;
	clientLines: string[];
	requester: string;
	date: string; // dd/mm/aaaa
};

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

// ── Cabeçalho / rodapé ───────────────────────────────────────────────────────

function pageHeader(background: Buffer, logo: Buffer): Header {
	return new Header({
		children: [
			new Paragraph({
				children: [
					// Fundo da página inteira: faixa azul no topo e faixas preta/azul no rodapé.
					new ImageRun({
						type: 'png',
						data: background,
						transformation: { width: PAGE_W_PX, height: PAGE_H_PX },
						floating: {
							horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
							verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
							behindDocument: true,
							allowOverlap: true,
						},
					}),
					new ImageRun({
						type: 'png',
						data: logo,
						transformation: { width: 159, height: 104 },
						floating: {
							horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(16.6 * EMU_PER_PT) },
							verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(26 * EMU_PER_PT) },
							allowOverlap: true,
						},
					}),
				],
			}),
		],
	});
}

function pageFooter(withPageNumber: boolean): Footer {
	const line = (text: string) =>
		new Paragraph({
			alignment: AlignmentType.CENTER,
			children: [new TextRun({ text, font: FONT, size: 22 })],
		});

	const children = [line(EMPRESA_ENDERECO), line(EMPRESA_CNPJ)];
	if (withPageNumber) {
		children.push(
			new Paragraph({
				alignment: AlignmentType.RIGHT,
				spacing: { before: 120 },
				children: [
					new TextRun({ font: FONT, size: 22, children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES] }),
				],
			}),
		);
	}
	return new Footer({ children });
}

// ── Blocos de conteúdo ───────────────────────────────────────────────────────

function heading(text: string, before = 240): Paragraph {
	return new Paragraph({
		spacing: { before, after: 200 },
		children: [new TextRun({ text, bold: true, size: 32, color: COLOR_HEADING, font: FONT })],
	});
}

function coverPage(info: AtestoInfo): Paragraph[] {
	const centered = (text: string, size: number, after = 0) =>
		new Paragraph({
			alignment: AlignmentType.CENTER,
			spacing: { after },
			children: [new TextRun({ text, bold: true, size, font: FONT })],
		});

	return [
		new Paragraph({ spacing: { before: 4400 }, children: [] }),
		centered(info.projectName.toLocaleUpperCase('pt-BR'), 48, 60),
		centered('DOCUMENTO DE ATESTO', 42, 360),
		centered('Cliente', 28, 40),
		...info.clientLines.map((line) => centered(line, 26)),
		new Paragraph({ children: [new PageBreak()] }),
	];
}

function introduction(info: AtestoInfo): Paragraph[] {
	const run = (text: string, bold = false) => new TextRun({ text, bold, size: 24, font: FONT });

	return [
		heading('Introdução', 1600),
		new Paragraph({
			alignment: AlignmentType.JUSTIFIED,
			spacing: { after: 240, line: 300 },
			children: [
				run('Este documento intitulado de DOCUMENTO DE ATESTO visa formalizar a entrega e o aceite dos itens do '),
				run(`${info.projectName.toLocaleUpperCase('pt-BR')}, `, true),
				new TextRun({ text: ENTREGA_PLACEHOLDER, bold: true, size: 24, font: FONT, highlight: HighlightColor.YELLOW }),
				run(' referente às solicitações da '),
				run(info.requester, true),
			],
		}),
		new Paragraph({
			alignment: AlignmentType.JUSTIFIED,
			spacing: { after: 240, line: 300 },
			children: [
				run('Todos os produtos e artefatos foram produzidos conforme as normas estabelecidas no contrato firmado entre a empresa '),
				run(CONTRATADA, true),
				run(' e a '),
				run(CONTRATANTE, true),
				run('.'),
			],
		}),
		heading('Relação de Entregas:'),
	];
}

const CELL_BORDERS = {
	top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
	bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
	left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
	right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};

function deliveriesTable(cases: CaseRow[], descriptions: string[]): Table {
	const COL_WIDTHS = [33, 67];

	const headerCell = (text: string, width: number) =>
		new TableCell({
			width: { size: width, type: WidthType.PERCENTAGE },
			borders: CELL_BORDERS,
			shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLOR_TABLE_HEADER },
			verticalAlign: VerticalAlign.CENTER,
			margins: { top: 60, bottom: 60, left: 100, right: 100 },
			children: [new Paragraph({ children: [new TextRun({ text, color: 'FFFFFF', size: 28, font: FONT })] })],
		});

	const bodyCell = (text: string, width: number) =>
		new TableCell({
			width: { size: width, type: WidthType.PERCENTAGE },
			borders: CELL_BORDERS,
			verticalAlign: VerticalAlign.CENTER,
			margins: { top: 40, bottom: 40, left: 100, right: 100 },
			children: text
				.split('\n')
				.map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 20, font: TABLE_FONT })] })),
		});

	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: [
			new TableRow({
				tableHeader: true,
				children: [headerCell('Funcionalidades', COL_WIDTHS[0]!), headerCell('Descrição das funcionalidades', COL_WIDTHS[1]!)],
			}),
			...cases.map(
				(c, i) =>
					new TableRow({
						cantSplit: true,
						children: [
							bodyCell(stripHtml(c.CAS_RESUMO ?? ''), COL_WIDTHS[0]!),
							bodyCell(descriptions[i] ?? stripHtml(c.CAS_DESCRICAO ?? ''), COL_WIDTHS[1]!),
						],
					}),
			),
		],
	});
}

function signaturePage(info: AtestoInfo): Paragraph[] {
	const centered = (text: string, size: number, before = 0) =>
		new Paragraph({
			alignment: AlignmentType.CENTER,
			spacing: { before },
			children: [new TextRun({ text, bold: true, size, font: FONT })],
		});

	return [
		new Paragraph({ children: [new PageBreak()] }),
		new Paragraph({ children: [new TextRun({ text: 'ATESTADO O SERVIÇO POR:', bold: true, size: 28, font: FONT })] }),
		centered('_________________________________', 28, 2400),
		centered('Assinatura do responsável', 28),
		centered(info.requester, 28),
		centered(`${CIDADE}, ${info.date}`, 28, 3000),
	];
}

async function attachmentsSection(attachments: AttachmentRow[]): Promise<Paragraph[]> {
	const out: Paragraph[] = [];

	// Dimensões que cabem 2 imagens por página A4 sem distorcer
	const MAX_W = 440;
	const MAX_H = 420;

	const label = (text: string) =>
		new Paragraph({
			spacing: { before: 240, after: 60 },
			children: [new TextRun({ text, bold: true, size: 18, color: COLOR_TABLE_HEADER, font: FONT })],
		});

	for (const att of attachments) {
		const pages = await convertAttachment(att);

		if (pages.length === 0) {
			out.push(
				label(`Card: ${att.COD_CASO}`),
				new Paragraph({
					children: [new TextRun({ text: '[Anexo não pôde ser renderizado]', italics: true, color: '999999', font: FONT })],
				}),
			);
			continue;
		}

		for (const [idx, page] of pages.entries()) {
			// Mantém proporção respeitando os dois limites
			const scale = Math.min(MAX_W / page.width, MAX_H / page.height);
			out.push(
				label(pages.length > 1 ? `Card: ${att.COD_CASO}   |   Pág. ${idx + 1} / ${pages.length}` : `Card: ${att.COD_CASO}`),
				new Paragraph({
					alignment: AlignmentType.CENTER,
					spacing: { after: 200 },
					children: [
						new ImageRun({
							data: page.buf,
							transformation: { width: Math.round(page.width * scale), height: Math.round(page.height * scale) },
							type: 'png',
						}),
					],
				}),
			);
		}
	}

	if (out.length === 0) return [];
	return [new Paragraph({ children: [new PageBreak()] }), heading('Anexos', 0), ...out];
}

// ── Montagem ─────────────────────────────────────────────────────────────────

export async function createDocument(
	cases: CaseRow[],
	attachments: AttachmentRow[],
	info: AtestoInfo,
): Promise<string> {
	const aiInput = cases.map((c) => {
		const title = stripHtml(c.CAS_RESUMO ?? '');
		const description = stripHtml(c.CAS_DESCRICAO ?? '');
		return `Funcionalidade: ${title}\nDescrição: ${description}`;
	});
	const fallback = cases.map((c) => stripHtml(c.CAS_DESCRICAO ?? ''));
	const enriched = await enrichDescriptions(aiInput);
	// Se a IA falhar, enrichDescriptions devolve a própria entrada; nesse caso usa só a descrição.
	const descriptions = enriched === aiInput ? fallback : enriched;

	const background = fs.readFileSync(path.join(ASSETS_DIR, 'fundo-pagina.png'));
	const logo = fs.readFileSync(path.join(ASSETS_DIR, 'logo-sudoeste.png'));
	const header = pageHeader(background, logo);

	const doc = new Document({
		styles: { default: { document: { run: { font: FONT, size: 24 } } } },
		sections: [
			{
				properties: {
					titlePage: true,
					page: {
						size: { width: 11906, height: 16838 },
						margin: { top: 2700, bottom: 1900, left: 1134, right: 1134, header: 500, footer: 700 },
					},
				},
				headers: { default: header, first: header },
				footers: { default: pageFooter(true), first: pageFooter(false) },
				children: [
					...coverPage(info),
					...introduction(info),
					deliveriesTable(cases, descriptions),
					...signaturePage(info),
					...(await attachmentsSection(attachments)),
				],
			},
		],
	});

	const buffer = await Packer.toBuffer(doc);
	if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
	const outPath = path.join(TMP_DIR, `Atesto_Final_${Date.now()}.docx`);
	fs.writeFileSync(outPath, buffer);
	return outPath;
}
