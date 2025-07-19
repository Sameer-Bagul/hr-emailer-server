const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const { parseExcelFile } = require('./parser');
const { sendEmailBatch } = require('./mailer');
const { compileTemplate } = require('./templateEngine');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'file') {
      // Excel files for contact list
      const allowedTypes = ['.xlsx', '.xls'];
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(fileExt)) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed for contact list'), false);
      }
    } else if (file.fieldname === 'resume') {
      // PDF files for resume
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (fileExt === '.pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed for resume'), false);
      }
    } else {
      cb(new Error('Unexpected field'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'HR Emailer Server is running!' });
});

// Get fixed template
app.get('/api/template', (req, res) => {
  try {
    const templatePath = path.join(__dirname, 'fixed-template.txt');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Extract subject for preview
    const subjectMatch = templateContent.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : 'Opportunities in Software Development | {{company_name}}';
    
    // Remove subject line and any following empty lines from template content for preview
    const lines = templateContent.split('\n');
    const templateLines = lines.slice(1).filter((line, index) => {
      // Skip the first empty line after subject
      if (index === 0 && line.trim() === '') return false;
      return true;
    });
    const template = templateLines.join('\n').trim();
    
    res.json({ template, subject });
  } catch (error) {
    console.error('Error reading template:', error);
    res.status(500).json({ error: 'Failed to load template' });
  }
});

app.post('/send-emails', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'resume', maxCount: 1 }]), async (req, res) => {
  try {
    const { delayMs, resumeDocLink } = req.body;
    const files = req.files;
    const excelFile = files.file ? files.file[0] : null;
    const resumeFile = files.resume ? files.resume[0] : null;

    if (!excelFile) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    // Load fixed template
    const templatePath = path.join(__dirname, 'fixed-template.txt');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Extract subject from template (first line after "Subject: ")
    const subjectMatch = templateContent.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : 'Opportunities in Software Development | {{company_name}}';
    
    // Remove subject line and any following empty lines from template content for email body
    const lines = templateContent.split('\n');
    const templateLines = lines.slice(1).filter((line, index) => {
      // Skip the first empty line after subject
      if (index === 0 && line.trim() === '') return false;
      return true;
    });
    const template = templateLines.join('\n').trim();

    // Parse Excel file
    const recipients = await parseExcelFile(excelFile.path);
    
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipients found in Excel file' });
    }

    // Limit to 300 recipients
    const limitedRecipients = recipients.slice(0, 300);

    // Compile template
    const compiledTemplate = compileTemplate(template);

    // Send initial response
    res.json({ 
      message: 'Email sending started', 
      totalEmails: limitedRecipients.length,
      recipients: limitedRecipients.map(r => ({ company: r.company_name, email: r.email }))
    });

    // Prepare attachment data
    const attachmentData = {
      resumeFile: resumeFile ? {
        filename: resumeFile.originalname,
        path: resumeFile.path,
        contentType: 'application/pdf'
      } : null,
      resumeDocLink: resumeDocLink || null
    };

    // Start sending emails asynchronously
    sendEmailBatch(limitedRecipients, compiledTemplate, subject, delayMs || 10000, io, attachmentData);

    // Clean up uploaded files
    fs.unlinkSync(excelFile.path);
    if (resumeFile) {
      // Clean up resume file after emails are sent (handled in mailer.js)
    }

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket connection
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    // Client disconnected
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
