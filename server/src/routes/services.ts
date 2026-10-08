import { Router } from 'express';
import {
  listServiceServers,
  listServices,
  runServiceAction,
  getServiceLogs,
  getServiceActions,
} from '../controllers/servicesController.js';

const router = Router();

router.get('/service-servers', listServiceServers);
router.get('/service-actions', getServiceActions);
router.get('/servers/:id/services', listServices);
router.get('/servers/:id/services/:name/logs', getServiceLogs);
router.post('/servers/:id/services/:name/:action', runServiceAction);

export default router;
