'use strict';
/**
 * fileRoutes.js — All file API endpoints
 *
 * POST   /api/files/upload            single file (field: "file")
 * POST   /api/files/upload-multiple   multiple files (field: "files")
 * GET    /api/files                   list all (paginated)
 * GET    /api/files/stats             storage stats
 * GET    /api/files/search?q=         search by name
 * GET    /api/files/:id/info          metadata only
 * GET    /api/files/:id/download      force download
 * GET    /api/files/:id               stream to browser
 * DELETE /api/files                   bulk delete
 * DELETE /api/files/:id               delete single
 */

const router = require('express').Router();
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { validateId, validateListQuery } = require('../middleware/validate');
const ctrl = require('../controllers/fileController');

// Upload
router.post('/upload',           uploadSingle,             ctrl.uploadSingle);
router.post('/upload-multiple',  uploadMultiple,           ctrl.uploadMultiple);

// Read
router.get('/stats',                                       ctrl.getStats);
router.get('/search',                                      ctrl.searchFiles);
router.get('/',                  validateListQuery,        ctrl.getAllFiles);
router.get('/:id/info',          validateId('id'),         ctrl.getFileInfo);
router.get('/:id/download',      validateId('id'),         ctrl.downloadFile);
router.get('/:id',               validateId('id'),         ctrl.streamFile);

// Delete
router.delete('/',                                         ctrl.deleteBulk);
router.delete('/:id',            validateId('id'),         ctrl.deleteFile);

module.exports = router;
