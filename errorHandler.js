'use strict';
const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} — ${err.message}`);

  if (err instanceof multer.MulterError) {
    const maxMB = Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10485760) / 1024 / 1024);
    const msgs = {
      LIMIT_FILE_SIZE:       `File too large. Maximum is ${maxMB}MB.`,
      LIMIT_FILE_COUNT:      'Too many files. Maximum is 10 per request.',
      LIMIT_UNEXPECTED_FILE: 'Wrong field name. Use "file" for single or "files" for multiple.',
    };
    return res.status(400).json({
      success: false,
      error: { code: err.code, message: msgs[err.code] || err.message },
    });
  }

  if (err.message?.includes('not allowed')) {
    return res.status(415).json({
      success: false,
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: err.message },
    });
  }

  if (err.message?.includes('not found')) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message },
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: err.message },
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} not found.` },
  });
};

module.exports = { errorHandler, notFound };
