'use strict';

const validateId = (param = 'id') => (req, res, next) => {
  const id = req.params[param];
  // UUID v4 format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: `"${id}" is not a valid file ID.` },
    });
  }
  next();
};

const validateListQuery = (req, res, next) => {
  const { page = 1, limit = 20, sort = 'uploadDate', order = 'desc' } = req.query;
  const p = parseInt(page), l = parseInt(limit);

  if (isNaN(p) || p < 1)
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'page must be >= 1' } });
  if (isNaN(l) || l < 1 || l > 100)
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'limit must be 1-100' } });
  if (!['uploadDate', 'originalName', 'length'].includes(sort))
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'sort must be uploadDate | originalName | length' } });
  if (!['asc', 'desc'].includes(order))
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'order must be asc | desc' } });

  req.pagination = { page: p, limit: l, sort, order };
  next();
};

module.exports = { validateId, validateListQuery };
