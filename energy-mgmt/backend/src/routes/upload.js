const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/authMiddleware');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Check if ?type=ppc, otherwise default to inverters
    const type = req.query.type === 'ppc' ? 'ppc' : 'inverters';
    const destDir = path.join(uploadsDir, type);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // Save file with unique timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

const ALLOWED_EXTENSIONS = ['.xlsx', '.pdf', '.csv'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain'
];

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME_TYPES.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .pdf files are allowed.'));
    }
  }
});

// Middleware wrapper to handle Multer validation errors gracefully
const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// POST /api/upload - single file upload (partitioned by type query param)
router.post('/', authenticateToken, uploadSingle, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  return res.status(200).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

// GET /api/upload/download/:filename - secure public download by unique filename (checks subfolders and fallback root)
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  
  const ppcPath = path.join(uploadsDir, 'ppc', safeFilename);
  const invertersPath = path.join(uploadsDir, 'inverters', safeFilename);
  const fallbackPath = path.join(uploadsDir, safeFilename);

  let filePath = '';
  if (fs.existsSync(ppcPath)) {
    filePath = ppcPath;
  } else if (fs.existsSync(invertersPath)) {
    filePath = invertersPath;
  } else if (fs.existsSync(fallbackPath)) {
    filePath = fallbackPath;
  } else {
    return res.status(404).json({ error: 'File not found' });
  }

  return res.download(filePath, safeFilename, (err) => {
    if (err) {
      console.error('File download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: `Failed to download file: ${err?.message || ''}` });
      }
    }
  });
});

// DELETE /api/upload/:filename - delete a file (Admin only)
router.delete('/:filename', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin permissions required' });
  }

  const filename = req.params.filename;
  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  
  const ppcPath = path.join(uploadsDir, 'ppc', safeFilename);
  const invertersPath = path.join(uploadsDir, 'inverters', safeFilename);
  const fallbackPath = path.join(uploadsDir, safeFilename);

  let filePath = '';
  if (fs.existsSync(ppcPath)) filePath = ppcPath;
  else if (fs.existsSync(invertersPath)) filePath = invertersPath;
  else if (fs.existsSync(fallbackPath)) filePath = fallbackPath;

  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return res.status(200).json({ message: 'File deleted successfully' });
    } catch (err) {
      console.error('Error deleting file:', err);
      return res.status(500).json({ error: `Failed to delete file from local storage: ${err?.message || ''}` });
    }
  } else {
    // If the file is not on disk (e.g. legacy database reference), return success to allow clearing the DB reference anyway
    return res.status(200).json({ message: 'File reference cleaned (file was not on disk)' });
  }
});

module.exports = router;
