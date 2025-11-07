/**
 * Backup routes: handle backup upload requests
 */
import express from 'express';
import * as controller from '../controllers/backup.controller';

const router = express.Router();

// POST /api/backup/upload - Request pre-signed URL for backup upload
router.post('/upload', controller.requestUploadUrl);

export default router;

