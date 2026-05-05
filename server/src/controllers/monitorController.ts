import type { Request, Response } from 'express';
import { getConnection, sql } from '../config/database.js';

interface TaskRow {
  NOME: string;
  TAREFA: string;
  SPRINT: string;
  INICIO: Date;
  FIM: Date | null;
}

interface TaskEntry {
  tarefa: string;
  sprint: string;
  inicio: string;
  fim: string | null;
  durationMinutes: number;
}

interface CollaboratorActivity {
  nome: string;
  totalMinutes: number;
  taskCount: number;
  tasks: TaskEntry[];
}

export async function getDailyActivity(req: Request, res: Response) {
  try {
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'Parâmetro "date" obrigatório (formato: YYYY-MM-DD)' });
      return;
    }

    const pool = await getConnection();
    console.log(date);
    const result = await pool
      .request()
      .input('DT', sql.VarChar(10), date)
      .query(`
        SELECT
          G.PES_NOME AS NOME,
          V.VER_NOME AS SPRINT,
          C.CAS_RESUMO AS TAREFA,
          T.CT_DATA AS INICIO,
          T.CT_DATA_CONCLUSAO AS FIM
        FROM SUP_PROJETO P WITH(NOLOCK)
        INNER JOIN SUP_VERSAO V WITH(NOLOCK) ON V.VER_COD_PROJETO = P.COD_PROJETO
        INNER JOIN SUP_CASO C WITH(NOLOCK) ON C.CAS_COD_VERSAO = V.COD_VERSAO
        INNER JOIN SUP_CASO_TAREFA T WITH(NOLOCK) ON T.CT_COD_CASO = C.COD_CASO
        INNER JOIN GER_PESSOA G WITH(NOLOCK) ON T.COD_TECNICO_TAREFA_CONCLUSAO = G.PES_COD
        WHERE
          P.PES_COD_GERENTE = 37318
          AND CAST(T.CT_DATA AS DATE) = @DT
        ORDER BY
          G.PES_NOME,
          T.CT_DATA DESC
      `);

    const rows: TaskRow[] = result.recordset;

    const map = new Map<string, CollaboratorActivity>();

    for (const row of rows) {
      const start = new Date(row.INICIO);
      const end = row.FIM ? new Date(row.FIM) : null;
      const durationMs = end ? end.getTime() - start.getTime() : 0;
      const durationMinutes = Math.max(0, durationMs / 60000);

      if (!map.has(row.NOME)) {
        map.set(row.NOME, { nome: row.NOME, totalMinutes: 0, taskCount: 0, tasks: [] });
      }

      const collab = map.get(row.NOME)!;
      collab.totalMinutes += durationMinutes;
      collab.taskCount += 1;
      collab.tasks.push({
        sprint: row.SPRINT,
        tarefa: row.TAREFA,
        inicio: start.toISOString(),
        fim: end ? end.toISOString() : null,
        durationMinutes,
      });
    }

    res.json(Array.from(map.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
