import type { Request, Response } from 'express';
import { findById, findAll } from '../services/jsonStorage.js';
import { deployJar, uploadFile } from '../services/sshService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const fsStat = promisify(fs.stat);
const TEMP_DIR = path.join(os.tmpdir(), 'edustack-jars');

interface Server {
  id: number;
  ip: string;
  portaSsh: number;
  usuarioSsh: string | null;
  senhaSsh: string | null;
}

interface Environment {
  id: number;
  codServidor: number;
  login: string;
  senha: string;
  contexto: string;
  systemCode: string;
  makerInterna: string | null;
}

interface Sistema {
  id: number;
  codServidor: number;
  nome: string;
  pathRaiz: string;
  nomeServico: string;
}

function buildSoapXml(user: string, password: string, systemCode: string, compileClasses: boolean, generateReports: boolean, generateAllRules: boolean): string {
  return `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://web.wfr">
   <soapenv:Header/>
   <soapenv:Body>
      <web:compileJAR soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <user xsi:type="xsd:string">${user}</user>
         <password xsi:type="xsd:string">${password}</password>
         <systemCode xsi:type="xsd:string">${systemCode}</systemCode>
         <compileClasses xsi:type="xsd:boolean">${compileClasses}</compileClasses>
         <generateReports xsi:type="xsd:boolean">${generateReports}</generateReports>
         <generateAllRules xsi:type="xsd:boolean">${generateAllRules}</generateAllRules>
      </web:compileJAR>
   </soapenv:Body>
</soapenv:Envelope>`;
}

function extractDownloadPath(soapResponse: string): string {
  const faultRegex = /<faultstring[^>]*>(.*?)<\/faultstring>/;
  const faultMatch = soapResponse.match(faultRegex);
  if (faultMatch) {
    throw new Error(`SOAP Fault: ${faultMatch[1]}`);
  }

  if (soapResponse.includes('ERROR:') || soapResponse.includes('<!-- ERROR')) {
    throw new Error(`Servidor retornou erro: ${soapResponse.substring(0, 500)}`);
  }

  const regex = /<compileJARReturn[^>]*>(.*?)<\/compileJARReturn>/;
  const match = soapResponse.match(regex);
  if (!match) {
    throw new Error(`Tag <compileJARReturn> não encontrada. Resposta: ${soapResponse.substring(0, 500)}`);
  }
  return match[1]!.replace(/amp;/g, '');
}

function toUncPath(serverIp: string, windowsPath: string): string {
  const normalized = windowsPath.replace(/\//g, '\\');
  const match = normalized.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) return `\\\\${serverIp}\\${normalized}`;
  return `\\\\${serverIp}\\${match[1]}$\\${match[2]}`;
}

export async function generateJar(req: Request, res: Response) {
  try {
    const {
      ambienteId,
      sistemaIds,
      compileClasses = true,
      generateReports = false,
      generateAllRules = true
    } = req.body;

    if (!ambienteId) {
      res.status(400).json({ error: 'ambienteId obrigatório' });
      return;
    }

    const ambiente = findById(  'environments', ambienteId);
    if (!ambiente) {
      res.status(404).json({ error: 'Ambiente não encontrado' });
      return;
    }

    const server = findById('servers', ambiente.codServidor);
    if (!server) {
      res.status(404).json({ error: 'Servidor do ambiente não encontrado' });
      return;
    }

    const baseUrl = ambiente.url || `http://${server.ip}`;
    const soapUrl = `${baseUrl}/${ambiente.contexto}/services/WFRAdminWebService`;
    const soapXml = buildSoapXml(
      ambiente.login,
      ambiente.senha,
      ambiente.systemCode,
      compileClasses,
      generateReports,
      generateAllRules
    );

    console.log('[JAR] POST SOAP →', soapUrl);

    const soapResponse = await fetch(soapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'compileJAR',
      },
      body: soapXml,
    });

    if (!soapResponse.ok) {
      res.status(502).json({
        error: `SOAP request failed: ${soapResponse.status} ${soapResponse.statusText}`,
        url: soapUrl,
      });
      return;
    }

    const soapXmlResponse = await soapResponse.text();
    const downloadPath = extractDownloadPath(soapXmlResponse);
    const downloadUrl = `${baseUrl}/${ambiente.contexto}/${downloadPath}`;

    console.log('[JAR] SOAP response path:', downloadPath);
    console.log('[JAR] GET download →', downloadUrl);

    const jarResponse = await fetch(downloadUrl);
    if (!jarResponse.ok) {
      res.status(502).json({
        error: `Download failed: ${jarResponse.status}`,
        downloadUrl,
        extractedPath: downloadPath,
      });
      return;
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const urlParams = new URLSearchParams(downloadPath.split('?')[1]);
    const jarFileName = urlParams.get('name') || `${ambiente.systemCode}.jar`;
    const localJarPath = path.join(TEMP_DIR, jarFileName);

    const jarBuffer = Buffer.from(await jarResponse.arrayBuffer());
    fs.writeFileSync(localJarPath, jarBuffer);

    const deployResults: any[] = [];

    if (sistemaIds && sistemaIds.length > 0) {
      for (const sistemaId of sistemaIds) {
        const sistema = findById('systems', sistemaId);
        if (!sistema) {
          deployResults.push({ sistemaId, success: false, error: 'Sistema não encontrado' });
          continue;
        }

        const srvDest = findById('servers', sistema.codServidor);
        if (!srvDest) {
          deployResults.push({ sistemaId, nome: sistema.nome, success: false, error: 'Servidor destino não encontrado' });
          continue;
        }

        try {
          const result = await deployJar(
            {
              host: srvDest.ip,
              port: srvDest.portaSsh || 22,
              username: srvDest.usuarioSsh!,
              password: srvDest.senhaSsh!,
            },
            localJarPath,
            sistema.pathRaiz,
            jarFileName,
            sistema.nomeServico
          );
          deployResults.push({ sistemaId, nome: sistema.nome, success: true, ...result });
        } catch (deployErr: any) {
          deployResults.push({ sistemaId, nome: sistema.nome, success: false, error: deployErr.message });
        }
      }
    }

    fs.unlink(localJarPath, () => {});

    res.json({ success: true, jarFileName, downloadUrl, deployResults });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listReports(req: Request, res: Response) {
  try {
    const ambienteId = parseInt(req.params['id'] as string);
    const ambiente = findById('environments', ambienteId);
    if (!ambiente) {
      res.status(404).json({ error: 'Ambiente não encontrado' });
      return;
    }

    if (!ambiente.makerInterna) {
      res.status(400).json({ error: 'Maker.Commons Interna não configurada neste ambiente' });
      return;
    }

    const server = findById('servers', ambiente.codServidor);
    if (!server) {
      res.status(404).json({ error: 'Servidor não encontrado' });
      return;
    }

    const reportsPath = path.join(
      toUncPath(server.ip, ambiente.makerInterna),
      'relatorios'
    );

    if (!fs.existsSync(reportsPath)) {
      res.status(404).json({ error: `Pasta relatorios não encontrada: ${reportsPath}` });
      return;
    }

    const entries = await readdir(reportsPath);
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(reportsPath, entry);
      const fileStat = await fsStat(fullPath);
      files.push({
        name: entry,
        size: fileStat.size,
        isDirectory: fileStat.isDirectory(),
        modified: fileStat.mtime,
      });
    }

    res.json({ path: reportsPath, files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deployReports(req: Request, res: Response) {
  try {
    const { ambienteId, sistemaIds, fileNames } = req.body;

    if (!ambienteId || !sistemaIds?.length || !fileNames?.length) {
      res.status(400).json({ error: 'ambienteId, sistemaIds e fileNames obrigatórios' });
      return;
    }

    const ambiente = findById('environments', ambienteId);
    if (!ambiente?.makerInterna) {
      res.status(404).json({ error: 'Ambiente ou Maker.Commons não encontrado' });
      return;
    }

    const server = findById('servers', ambiente.codServidor);
    if (!server) {
      res.status(404).json({ error: 'Servidor não encontrado' });
      return;
    }

    const reportsPath = path.join(
      toUncPath(server.ip, ambiente.makerInterna),
      'relatorios'
    );

    const results: any[] = [];

    for (const sistemaId of sistemaIds) {
      const sistema = findById('systems', sistemaId);
      if (!sistema) {
        results.push({ sistemaId, success: false, error: 'Sistema não encontrado' });
        continue;
      }

      const srvDest = findById('servers', sistema.codServidor);
      if (!srvDest) {
        results.push({ sistemaId, nome: sistema.nome, success: false, error: 'Servidor destino não encontrado' });
        continue;
      }

      const sshConfig = {
        host: srvDest.ip,
        port: srvDest.portaSsh || 22,
        username: srvDest.usuarioSsh!,
        password: srvDest.senhaSsh!,
      };

      for (const fileName of fileNames) {
        const localFilePath = path.join(reportsPath, fileName);
        const remoteFilePath = path.posix.join(sistema.pathRaiz, 'relatorios', fileName);

        try {
          await uploadFile(sshConfig, localFilePath, remoteFilePath);
          results.push({ sistema: sistema.nome, file: fileName, success: true });
        } catch (err: any) {
          results.push({ sistema: sistema.nome, file: fileName, success: false, error: err.message });
        }
      }
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function uploadReportsFiles(req: Request, res: Response) {
  try {
    const sistemaIds: number[] = JSON.parse(req.body.sistemaIds || '[]');
    const files = (req as any).files as Express.Multer.File[];

    if (!files?.length) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    if (!sistemaIds.length) {
      res.status(400).json({ error: 'sistemaIds obrigatório' });
      return;
    }

    const results: any[] = [];

    for (const sistemaId of sistemaIds) {
      const sistema = findById('systems', sistemaId);
      if (!sistema) {
        results.push({ sistemaId, success: false, error: 'Sistema não encontrado' });
        continue;
      }

      const srvDest = findById('servers', sistema.codServidor);
      if (!srvDest) {
        results.push({ sistemaId, nome: sistema.nome, success: false, error: 'Servidor não encontrado' });
        continue;
      }

      const sshConfig = {
        host: srvDest.ip,
        port: srvDest.portaSsh || 22,
        username: srvDest.usuarioSsh!,
        password: srvDest.senhaSsh!,
      };

      for (const file of files) {
        const remoteFilePath = path.posix.join(sistema.pathRaiz, 'Maker.Commons', 'relatorios', file.originalname);

        try {
          await uploadFile(sshConfig, file.path, remoteFilePath);
          results.push({ sistema: sistema.nome, file: file.originalname, success: true });
        } catch (err: any) {
          results.push({ sistema: sistema.nome, file: file.originalname, success: false, error: err.message });
        }
      }
    }

    // Cleanup temp files
    for (const file of files) {
      fs.unlink(file.path, () => {});
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
