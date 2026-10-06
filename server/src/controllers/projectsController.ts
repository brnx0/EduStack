import type { Request, Response } from 'express';
import { getConnection, sql } from '../config/database.js';
import { createDocument } from '../services/docxService.js';
import path from 'path';
import fs from 'fs';

export async function listProjects(_req: Request, res: Response) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT DISTINCT V.COD_PROJETO, V.PRO_NOME, 1 as PRO_DESCRICAO
      FROM SUP_VERSAO_PROJETO_VI V
	    INNER JOIN SUP_PROJETO P ON P.COD_PROJETO = V.COD_PROJETO
	    WHERE P.PES_COD_GERENTE = 37318 AND P.PRO_STATUS = 1
      ORDER BY V.PRO_NOME
    `);
    res.json(result.recordset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listSprints(req: Request, res: Response) {
  try {
    const projectId = req.params['projectId'] as string;
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('cod', sql.Int, parseInt(projectId))
      .query(`
        SELECT COD_VERSAO, VER_NOME, VER_LIBERA, VER_DATA, VER_PREV_DATA
        FROM SUP_VERSAO_PROJETO_VI
        WHERE COD_PROJETO = @cod
        ORDER BY COD_VERSAO DESC
      `);
    res.json(result.recordset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

function formatDateBR(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export async function generateDocx(req: Request, res: Response) {
  try {
    const sprintId = req.params['sprintId'] as string;
    const body = req.body ?? {};

    const clientLines: string[] = Array.isArray(body.clientLines)
      ? body.clientLines.map((l: unknown) => String(l ?? '').trim()).filter(Boolean)
      : [];
    const requester = typeof body.requester === 'string' ? body.requester.trim() : '';
    const date = typeof body.date === 'string' ? formatDateBR(body.date) : null;

    if (clientLines.length === 0 || !requester || !date) {
      res.status(400).json({ error: 'Informe o cliente, a área solicitante e a data do atesto.' });
      return;
    }

    const pool = await getConnection();

    const projectResult = await pool
      .request()
      .input('sprintProj', sql.Int, parseInt(sprintId))
      .query(`
        SELECT TOP 1 PRO_NOME
        FROM SUP_VERSAO_PROJETO_VI
        WHERE COD_VERSAO = @sprintProj
      `);
    const projectName: string = projectResult.recordset[0]?.PRO_NOME?.trim() ?? '';

    const casesResult = await pool
      .request()
      .input('sprint', sql.Int, parseInt(sprintId))
      .query(`
        SELECT
          C.COD_CASO,
          C.CAS_RESUMO,
          REPLACE(V.VER_NOME, 'Sprint', '') AS Sprint,
          C.CAS_DESCRICAO
        FROM SUP_VERSAO V
        INNER JOIN SUP_CASO C ON C.CAS_COD_VERSAO = V.COD_VERSAO
        WHERE C.CAS_CAT = 2 AND V.COD_VERSAO = @sprint
      `);

    const cases = casesResult.recordset;

    if (!cases || cases.length === 0) {
      res.status(404).json({ error: 'Nenhum caso encontrado para este sprint.' });
      return;
    }

    const attachmentsResult = await pool
      .request()
      .input('sprint2', sql.Int, parseInt(sprintId))
      .query(`
        SELECT
          C.COD_CASO,
          A.UPR_COD,
          A.UPR_ARQUIVO
        FROM SUP_VERSAO V
        INNER JOIN SUP_CASO C ON C.CAS_COD_VERSAO = V.COD_VERSAO
        INNER JOIN SUP_UPLOAD_REQUISITO A ON C.COD_CASO = A.COD_CASO
        WHERE C.CAS_CAT = 2
          AND (A.UPR_TIPO LIKE '%png%' OR A.UPR_TIPO LIKE '%pdf%' OR A.UPR_TIPO LIKE '%jpg%')
          AND V.COD_VERSAO = @sprint2
      `);

    const attachments = attachmentsResult.recordset;

    const filePath = await createDocument(cases, attachments, { projectName, clientLines, requester, date });

    res.download(filePath, `Atesto_Sprint_${sprintId}.docx`, (err) => {
      if (!err) {
        fs.unlink(filePath, () => { });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
