'use strict';
/**
 * upload.js
 * ─────────────────────────────────────────────────────────
 * Multer middleware using memoryStorage.
 *
 * Files are received as multipart/form-data, held in memory
 * as Buffer objects, then passed to the GridFS-style storage
 * engine in fileController.js — exactly like real GridFS.
 *
 * Field names:
 *   single   → "file"
 *   multiple → "files" (max 10)
 */

const multer = require('multer');

const getAllowedTypes = () => {
  const env = process.env.ALLOWED_MIME_TYPES;
  if (env) return env.split(',').map(t => t.trim());
  return [
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf','text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip','video/mp4','audio/mpeg',
  ];
};

/* ── File filter: validate MIME type before accepting ── */
const fileFilter = (req, file, cb) => {
  const allowed = getAllowedTypes();
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(
      `File type "${file.mimetype}" is not allowed. ` +
      `Allowed: ${allowed.join(', ')}`
    ), false);
  }
};

/* ── Multer instance ─────────────────────────────────── */
const multerInstance = multer({
  storage: multer.memoryStorage(),   // buffer in RAM → we write to GridFS manually
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter,
});

/* ── Exported middleware ─────────────────────────────── */
const uploadSingle   = multerInstance.single('file');
const uploadMultiple = multerInstance.array('files', 10);

module.exports = { uploadSingle, uploadMultiple };
