'use strict';
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const fileRoutes = require('./routes/fileRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve built-in UI — same server = zero CORS problems
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (req, res) => res.json({
  success: true, status: 'healthy', service: 'FileVault',
  uptime: `${Math.floor(process.uptime())}s`,
  timestamp: new Date().toISOString(),
}));

// API
app.use('/api/files', fileRoutes);

// Fallback → UI
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/'))
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
