const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory');
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      cb(null, uploadsDir);
    } catch (error) {
      logger.error(`Error in multer destination: ${error.message}`);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Create unique filename with timestamp and sanitize original name
      const timestamp = Date.now();
      const originalName = path.basename(file.originalname); // Prevent path traversal
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
      const ext = path.extname(sanitizedName);
      const name = path.basename(sanitizedName, ext);
      const filename = `${timestamp}-${name}${ext}`;

      // Additional security check
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return cb(new Error('Invalid filename detected'));
      }

      cb(null, filename);
    } catch (error) {
      logger.error(`Error in multer filename: ${error.message}`);
      cb(error);
    }
  }
});

// File filter for Excel files
const excelFileFilter = (req, file, cb) => {
  if (file.fieldname === 'contactList') {
    // Allow Excel files only
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed for contact list'));
    }
  } else if (file.fieldname === 'resume') {
    // Allow PDF files only
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for resume'));
    }
  } else {
    cb(new Error(`Unexpected field: ${file.fieldname}`));
  }
};

// Legacy file filter for backward compatibility
const legacyFileFilter = (req, file, cb) => {
  logger.debug(`File upload - Field: ${file.fieldname}, MIME: ${file.mimetype}, Name: ${file.originalname}`);
  
  if (file.fieldname === 'file') {
    // Allow Excel and CSV files with multiple MIME types
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv', // .csv (alternative)
      'text/plain', // Sometimes CSV files are detected as plain text
      'application/octet-stream' // Sometimes files are detected as binary
    ];

    // Also check file extension as fallback
    const fileExt = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['xlsx', 'xls', 'csv'];

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      logger.error(`File rejected - MIME: ${file.mimetype}, Extension: ${fileExt}`);
      cb(new Error('Only Excel and CSV files are allowed for contact list'));
    }
  } else if (file.fieldname === 'resume') {
    // Allow PDF files only
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for resume'));
    }
  } else {
    cb(new Error(`Unexpected field: ${file.fieldname}`));
  }
};

// Multer configuration for modern API
const upload = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 2, // Maximum 2 files
    fields: 10 // Maximum 10 fields
  }
});

// Multer configuration for legacy API
const legacyUpload = multer({
  storage,
  fileFilter: legacyFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 2, // Maximum 2 files
    fields: 10 // Maximum 10 fields
  }
});

// Campaign creation upload middleware
const campaignUpload = upload.fields([
  { name: 'contactList', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// Legacy send-emails upload middleware
const legacySendEmailsUpload = legacyUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// Single file upload for templates
const templateUpload = upload.single('template');

// Cleanup old files middleware
const cleanupOldFiles = (req, res, next) => {
  try {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const now = Date.now();
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up old file: ${file}`);
        }
      });
    }
  } catch (error) {
    logger.error(`Error cleaning up old files: ${error.message}`);
  }
  
  next();
};

// File validation middleware
const validateUploadedFiles = (req, res, next) => {
  try {
    if (req.files) {
      // Validate contact list file
      if (req.files.contactList) {
        const contactFile = req.files.contactList[0];
        if (!contactFile.filename.match(/\.(xlsx|xls)$/i)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Contact list must be an Excel file (.xlsx or .xls)'
          });
        }
      }

      // Validate resume file
      if (req.files.resume) {
        const resumeFile = req.files.resume[0];
        if (!resumeFile.filename.match(/\.pdf$/i)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Resume must be a PDF file'
          });
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error(`File validation error: ${error.message}`);
    next(error);
  }
};

module.exports = {
  campaignUpload,
  legacySendEmailsUpload,
  templateUpload,
  cleanupOldFiles,
  validateUploadedFiles
};
