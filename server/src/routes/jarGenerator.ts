import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import * as servers from '../controllers/serversController.js';
import * as environments from '../controllers/environmentsController.js';
import * as systems from '../controllers/systemsController.js';
import * as jar from '../controllers/jarController.js';

const upload = multer({ dest: os.tmpdir() });

const router = Router();

// Servidores
router.get('/servers', servers.listServers);
router.get('/servers/:id', servers.getServer);
router.post('/servers', servers.createServer);
router.put('/servers/:id', servers.updateServer);
router.delete('/servers/:id', servers.deleteServer);

// Ambientes
router.get('/environments', environments.listEnvironments);
router.get('/environments/:id', environments.getEnvironment);
router.post('/environments', environments.createEnvironment);
router.put('/environments/:id', environments.updateEnvironment);
router.delete('/environments/:id', environments.deleteEnvironment);

// Sistemas
router.get('/systems', systems.listSystems);
router.get('/systems/:id', systems.getSystem);
router.get('/systems/server/:serverId', systems.listSystemsByServer);
router.post('/systems', systems.createSystem);
router.put('/systems/:id', systems.updateSystem);
router.delete('/systems/:id', systems.deleteSystem);

// Relatórios
router.get('/environments/:id/reports', jar.listReports);
router.post('/deploy-reports', jar.deployReports);
router.post('/upload-reports', upload.array('files'), jar.uploadReportsFiles);

// Gerar JAR
router.post('/generate', jar.generateJar);

export default router;
