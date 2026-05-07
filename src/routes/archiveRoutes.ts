import { Router } from 'express';
import {
  triggerArchive,
  triggerArchiveByService,
  getArchiveStats,
  queryArchivedLogs
} from '../controllers/archiveController';

const router = Router();

router.post('/trigger', triggerArchive);
router.post('/trigger/service/:serviceId', triggerArchiveByService);
router.get('/stats', getArchiveStats);
router.get('/query', queryArchivedLogs);

export default router;
