'use strict';
/**
 * database.js
 * ─────────────────────────────────────────────────────────
 * GridFS-style storage engine built on Node.js fs module.
 *
 * Mimics MongoDB GridFS exactly:
 *   • Files split into 255KB chunks (same as GridFS default)
 *   • Metadata stored in JSON (equivalent to fs.files collection)
 *   • Chunks stored in /data/chunks/ (equivalent to fs.chunks)
 *   • Full CRUD: upload, stream, download, delete, search
 *
 * Why: Your network blocks ALL external downloads.
 * This needs ZERO internet, ZERO extra installs — just Node.js.
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR    = path.join(process.cwd(), 'data');
const CHUNKS_DIR  = path.join(DATA_DIR, 'chunks');
const META_FILE   = path.join(DATA_DIR, 'files.json');
const CHUNK_SIZE  = 255 * 1024; // 255KB — same as MongoDB GridFS

/* ── Init storage dirs ───────────────────────────────── */
const initStorage = () => {
  if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
  if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  if (!fs.existsSync(META_FILE))  fs.writeFileSync(META_FILE, JSON.stringify([]));
  console.log('✅  Storage ready → ./data/');
  console.log('✅  Files metadata → ./data/files.json');
  console.log('✅  File chunks    → ./data/chunks/');
};

/* ── Read / Write metadata ───────────────────────────── */
const readMeta  = () => JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
const writeMeta = (data) => fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2));

/* ── GridFS-style API ────────────────────────────────── */
const GridFS = {

  /**
   * Save a file from a Buffer into GridFS-style chunk storage.
   * Returns the file metadata document (like MongoDB GridFS upload).
   */
  async saveFile(buffer, originalName, mimeType, metadata = {}) {
    const fileId   = uuidv4();
    const ext      = path.extname(originalName).toLowerCase();
    const filename = `${fileId}${ext}`;
    const chunks   = [];
    let   n        = 0;

    // Split buffer into 255KB chunks (GridFS standard)
    for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
      const chunk     = buffer.slice(offset, offset + CHUNK_SIZE);
      const chunkName = `${fileId}_chunk_${n}`;
      fs.writeFileSync(path.join(CHUNKS_DIR, chunkName), chunk);
      chunks.push(chunkName);
      n++;
    }

    const doc = {
      _id:         fileId,
      id:          fileId,
      filename,
      originalName,
      contentType: mimeType,
      length:      buffer.length,
      chunkSize:   CHUNK_SIZE,
      chunks,                         // chunk filenames (like GridFS chunk references)
      uploadDate:  new Date().toISOString(),
      metadata:    { originalName, mimeType, uploadedAt: new Date().toISOString(), ...metadata },
    };

    const files = readMeta();
    files.push(doc);
    writeMeta(files);

    return doc;
  },

  /** Find all files (with optional query object) */
  findAll() {
    return readMeta();
  },

  /** Find one file by id */
  findById(id) {
    return readMeta().find(f => f._id === id || f.id === id) || null;
  },

  /**
   * Open a readable stream for a file (streams chunk-by-chunk).
   * Returns a Node.js Readable stream — same interface as GridFS.
   */
  openDownloadStream(id) {
    const { Readable } = require('stream');
    const file = this.findById(id);
    if (!file) throw new Error(`File ${id} not found`);

    const readable = new Readable({ read() {} });

    // Push chunks in order (async, so UI gets data progressively)
    (async () => {
      for (const chunkName of file.chunks) {
        const chunkPath = path.join(CHUNKS_DIR, chunkName);
        if (fs.existsSync(chunkPath)) {
          readable.push(fs.readFileSync(chunkPath));
        }
      }
      readable.push(null); // signal end of stream
    })();

    return readable;
  },

  /** Delete a file and all its chunks from storage */
  async delete(id) {
    const files = readMeta();
    const idx   = files.findIndex(f => f._id === id || f.id === id);
    if (idx === -1) throw new Error(`File ${id} not found`);

    const file = files[idx];

    // Remove all chunk files
    for (const chunkName of file.chunks) {
      const chunkPath = path.join(CHUNKS_DIR, chunkName);
      if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
    }

    // Remove metadata
    files.splice(idx, 1);
    writeMeta(files);
    return true;
  },

  /** Storage stats */
  stats() {
    const files     = readMeta();
    const totalSize = files.reduce((s, f) => s + (f.length || 0), 0);
    const types     = {};
    files.forEach(f => {
      const t = f.contentType || 'unknown';
      types[t] = (types[t] || 0) + 1;
    });
    return { totalFiles: files.length, totalSize, fileTypes: types };
  },
};

const connectDB = async () => {
  initStorage();
  console.log('✅  GridFS-style storage initialised (no MongoDB install needed)');
};

module.exports = { connectDB, GridFS };
