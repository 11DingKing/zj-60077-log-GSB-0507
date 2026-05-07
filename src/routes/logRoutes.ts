import { Router } from 'express';
import {
  receiveSingleLog,
  receiveBatchLogs,
  queryLogs,
  aggregateLogs,
  exportLogs
} from '../controllers/logController';

const router = Router();

router.post('/single', receiveSingleLog);
router.post('/batch', receiveBatchLogs);
router.get('/query', queryLogs);
router.get('/aggregate', aggregateLogs);
router.get('/export', exportLogs);

export default router;
