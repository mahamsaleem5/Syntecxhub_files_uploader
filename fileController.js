'use strict';
/**
 * fileController.js
 * ─────────────────────────────────────────────────────────
 * All file endpoints — Upload, Retrieval, Deletion.
 * Uses GridFS-style storage engine (database.js).
 */

const { GridFS } = require('../config/database');

/* ── Helpers ─────────────────────────────────────────── */
const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
};

const buildFileObj = (file, req) => ({
  id:            file._id || file.id,
  filename:      file.filename,
  originalName:  file.originalName || file.metadata?.originalName || file.filename,
  mimeType:      file.contentType  || file.metadata?.mimeType,
  size:          file.length,
  sizeFormatted: formatSize(file.length),
  uploadDate:    file.uploadDate,
  metadata:      file.metadata,
  urls: {
    view:     `${req.protocol}://${req.get('host')}/api/files/${file._id || file.id}`,
    download: `${req.protocol}://${req.get('host')}/api/files/${file._id || file.id}/download`,
    info:     `${req.protocol}://${req.get('host')}/api/files/${file._id || file.id}/info`,
  },
});

/* ══════════════════════════════════════════════════════
   UPLOAD
══════════════════════════════════════════════════════ */

/**
 * POST /api/files/upload
 * Multer puts file in req.file.buffer (memoryStorage).
 * We then save it to GridFS-style chunk storage.
 * Field name: "file"
 */
const uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No file received. Use field name "file".' },
      });
    }

    // Save buffer into GridFS-style chunk storage
    const doc = await GridFS.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      { uploadedByIp: req.ip }
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data:    buildFileObj(doc, req),
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/files/upload-multiple
 * Field name: "files"  (max 10)
 */
const uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILES', message: 'No files received. Use field name "files".' },
      });
    }

    const saved = [];
    for (const file of req.files) {
      const doc = await GridFS.saveFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        { uploadedByIp: req.ip }
      );
      saved.push(buildFileObj(doc, req));
    }

    res.status(201).json({
      success: true,
      message: `${saved.length} file(s) uploaded successfully`,
      count:   saved.length,
      data:    saved,
    });
  } catch (err) { next(err); }
};

/* ══════════════════════════════════════════════════════
   RETRIEVAL
══════════════════════════════════════════════════════ */

/**
 * GET /api/files?page=1&limit=20&sort=uploadDate&order=desc
 */
const getAllFiles = async (req, res, next) => {
  try {
    const { page, limit, sort, order } = req.pagination;
    const sortDir = order === 'asc' ? 1 : -1;

    let all = GridFS.findAll();

    // Sort
    all.sort((a, b) => {
      let av, bv;
      if (sort === 'length')      { av = a.length;       bv = b.length; }
      else if (sort === 'originalName') { av = (a.originalName||'').toLowerCase(); bv = (b.originalName||'').toLowerCase(); }
      else                        { av = new Date(a.uploadDate); bv = new Date(b.uploadDate); }
      return sortDir * (av > bv ? 1 : av < bv ? -1 : 0);
    });

    const total = all.length;
    const paged = all.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data:    paged.map(f => buildFileObj(f, req)),
      pagination: {
        page, limit, total,
        totalPages:  Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/files/stats
 */
const getStats = async (req, res, next) => {
  try {
    const s = GridFS.stats();
    res.json({
      success: true,
      data: {
        totalFiles:         s.totalFiles,
        totalSize:          s.totalSize,
        totalSizeFormatted: formatSize(s.totalSize),
        fileTypes:          s.fileTypes,
        dbMode:             'local',
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/files/search?q=keyword
 */
const searchFiles = async (req, res, next) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    if (!q.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_QUERY', message: 'Provide ?q=keyword' },
      });
    }

    const regex   = new RegExp(q.trim(), 'i');
    const all     = GridFS.findAll();
    const matched = all.filter(f =>
      regex.test(f.originalName || '') || regex.test(f.filename || '')
    );

    const p = parseInt(page), l = parseInt(limit);
    const paged = matched.slice((p - 1) * l, p * l);

    res.json({
      success: true,
      query:   q,
      data:    paged.map(f => buildFileObj(f, req)),
      pagination: {
        page: p, limit: l,
        total:      matched.length,
        totalPages: Math.ceil(matched.length / l) || 1,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/files/:id/info  — metadata only
 */
const getFileInfo = async (req, res, next) => {
  try {
    const file = GridFS.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `File "${req.params.id}" not found.` },
      });
    }
    res.json({ success: true, data: buildFileObj(file, req) });
  } catch (err) { next(err); }
};

/**
 * GET /api/files/:id  — stream file to browser
 */
const streamFile = async (req, res, next) => {
  try {
    const file = GridFS.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' },
      });
    }

    res.set('Content-Type',   file.contentType || 'application/octet-stream');
    res.set('Content-Length', file.length);
    res.set('Cache-Control',  'public, max-age=3600');
    res.set('Accept-Ranges',  'bytes');

    const stream = GridFS.openDownloadStream(req.params.id);
    stream.on('error', err => { if (!res.headersSent) next(err); });
    stream.pipe(res);
  } catch (err) { next(err); }
};

/**
 * GET /api/files/:id/download  — force download
 */
const downloadFile = async (req, res, next) => {
  try {
    const file = GridFS.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' },
      });
    }

    res.set('Content-Type',        'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${file.originalName || file.filename}"`);
    res.set('Content-Length',      file.length);

    const stream = GridFS.openDownloadStream(req.params.id);
    stream.on('error', err => { if (!res.headersSent) next(err); });
    stream.pipe(res);
  } catch (err) { next(err); }
};

/* ══════════════════════════════════════════════════════
   DELETION
══════════════════════════════════════════════════════ */

/**
 * DELETE /api/files/:id
 */
const deleteFile = async (req, res, next) => {
  try {
    const file = GridFS.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' },
      });
    }

    await GridFS.delete(req.params.id);

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: {
        id:           req.params.id,
        originalName: file.originalName,
        deletedAt:    new Date().toISOString(),
      },
    });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/files  — bulk delete
 * Body: { "ids": ["id1", "id2", ...] }
 */
const deleteBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_BODY', message: 'Provide an "ids" array in request body.' },
      });
    }
    if (ids.length > 50) {
      return res.status(400).json({
        success: false,
        error: { code: 'TOO_MANY', message: 'Max 50 files per bulk delete.' },
      });
    }

    const results = { deleted: [], notFound: [], errors: [] };

    for (const id of ids) {
      try {
        const file = GridFS.findById(id);
        if (!file) { results.notFound.push(id); continue; }
        await GridFS.delete(id);
        results.deleted.push(id);
      } catch (e) {
        results.errors.push({ id, error: e.message });
      }
    }

    res.json({
      success: true,
      message: 'Bulk delete complete',
      data: {
        requested: ids.length,
        deleted:   results.deleted.length,
        notFound:  results.notFound.length,
        errors:    results.errors.length,
        details:   results,
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  uploadSingle, uploadMultiple,
  getAllFiles, getStats, searchFiles,
  getFileInfo, streamFile, downloadFile,
  deleteFile, deleteBulk,
};
