import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getConnection, sql } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'edustack-dev-secret';

export async function login(req: Request, res: Response) {
  try {
    const { user, password } = req.body;

    if (!user || !password) {
      res.status(400).json({ error: 'Login e senha são obrigatórios' });
      return;
    }

    const pool = await getConnection();
    const result = await pool
      .request()
      .input('user', sql.NVarChar, user)
      .query(`
        SELECT DISTINCT U.USR_CODIGO, U.USR_LOGIN, U.USR_SENHA,
        CASE WHEN  U.USR_CODIGO IN (22376,23409) THEN 1 ELSE 0 END AS IS_ADMIN
        FROM FR_USUARIO U
        JOIN GER_PESSOA P ON P.USR_CODIGO = U.USR_CODIGO
        JOIN SUP_MEMBRO_PROJETO M ON P.PES_COD = M.PES_COD
        WHERE EXISTS (
          SELECT 1 FROM SUP_PROJETO PR
          WHERE
            PR.PES_COD_GERENTE = 37318
            AND PR.PRO_STATUS = 1
            AND PR.COD_PROJETO = M.COD_EQUIPE
        )
        AND U.USR_LOGIN = @user
      `);

    const record = result.recordset[0];
    if (!record) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    const hash = crypto
      .createHash('md5')
      .update(String(record.USR_CODIGO) + password)
      .digest('hex')
      .toUpperCase();

    if (hash !== String(record.USR_SENHA).toUpperCase()) {
      res.status(401).json({ error: 'Senha incorreta' });
      return;
    }

    const isAdmin = record.IS_ADMIN === 1;

    const token = jwt.sign(
      { id: record.USR_CODIGO, login: record.USR_LOGIN, isAdmin },
      JWT_SECRET,
      { expiresIn: '8h' },
    );

    res.json({
      token,
      user: { id: record.USR_CODIGO, login: record.USR_LOGIN, isAdmin },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
