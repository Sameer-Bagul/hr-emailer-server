# 🚀 HR Emailer Server - Backend API

A robust, scalable backend server for the HR Outreach Emailer application built with clean MVC architecture and modern Node.js practices.

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Server](#-running-the-server)
- [API Documentation](#-api-documentation)
- [File Upload Handling](#-file-upload-handling)
- [Email Configuration](#-email-configuration)
- [Security Features](#-security-features)
- [Troubleshooting](#-troubleshooting)

## 🏗️ Architecture Overview

### Directory Structure
```
server/
├── src/                      # Source code
│   ├── config/              # Configuration files
│   │   ├── database.js      # Database connection
│   │   ├── email.js         # Email service config
│   │   ├── multer.js        # File upload config
│   │   └── security.js      # Security settings
│   ├── controllers/         # HTTP request handlers
│   │   ├── emailController.js    # Email operations
│   │   ├── campaignController.js # Campaign management
│   │   └── templateController.js # Template handling
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.js       # Error handling
│   │   ├── security.js           # Security middleware
│   │   ├── validation.js         # Input validation
│   │   └── uploadMiddleware.js   # File upload middleware
│   ├── models/              # Data models
│   │   ├── Campaign.js      # Campaign model
│   │   ├── Email.js         # Email model
│   │   └── Template.js      # Template model
│   ├── routes/              # API route definitions
│   │   ├── emailRoutes.js   # Email endpoints
│   │   ├── campaignRoutes.js # Campaign endpoints
│   │   └── templateRoutes.js # Template endpoints
│   ├── services/            # Business logic services
│   │   ├── emailService.js       # Email sending logic
│   │   ├── campaignService.js    # Campaign management
│   │   ├── fileService.js        # File processing
│   │   └── schedulerService.js   # Automated scheduling
│   ├── sockets/             # Real-time communication
│   │   └── emailSocket.js   # Socket.IO handlers
│   └── utils/               # Utility functions
│       ├── logger.js        # Logging utility
│       ├── fileUtils.js     # File operations
│       └── dateUtils.js     # Date/time utilities
├── uploads/                 # File storage directory
├── campaigns.json           # Campaign data storage
├── server.js               # Application entry point
├── package.json            # Dependencies and scripts
└── .env                    # Environment variables
```

### Core Technologies
- **Node.js 18+** - Runtime environment
- **Express.js** - REST API framework
- **Socket.IO** - Real-time communication
- **Nodemailer** - Email sending via SMTP
- **Multer** - Secure file upload handling
- **Handlebars** - Email template engine
- **Node-cron** - Automated scheduling
- **Express-validator** - Request validation
- **Helmet** - Security headers
- **Express-rate-limit** - Rate limiting

## 📋 Prerequisites

Before installing, ensure you have the following:

- **Node.js 18.0.0 or higher** - [Download here](https://nodejs.org/)
- **npm 8.0.0 or higher** - Comes with Node.js
- **Gmail Account** - For email sending functionality
- **Git** - For cloning the repository

### System Requirements
- **RAM**: Minimum 512MB, Recommended 1GB+
- **Storage**: 100MB free space
- **Network**: Stable internet connection for email sending

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hr-email-automation/server
```

### 2. Install Dependencies
```bash
npm install
```

This will install all required dependencies including:
- Express.js for the web framework
- Nodemailer for email functionality
- Socket.IO for real-time updates
- Multer for file uploads
- And other supporting libraries

### 3. Environment Configuration

Create a `.env` file in the server root directory:

```env
# ===========================================
# EMAIL CONFIGURATION (REQUIRED)
# ===========================================
EMAIL=your-gmail@gmail.com
EMAIL_PASSWORD=your-16-character-app-password

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# ===========================================
# FILE UPLOAD CONFIGURATION
# ===========================================
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# ===========================================
# CAMPAIGN CONFIGURATION
# ===========================================
DAILY_EMAIL_LIMIT=300
DEFAULT_BATCH_SIZE=25
DEFAULT_BATCH_DELAY=10000
MAX_BATCH_SIZE=50
MIN_BATCH_SIZE=10
MAX_BATCH_DELAY=30000
MIN_BATCH_DELAY=5000

# ===========================================
# RATE LIMITING
# ===========================================
MAX_EMAILS_PER_HOUR=500
MAX_EMAILS_PER_MINUTE=50
MAX_EMAILS_PER_SECOND=5
MAX_EMAILS_PER_BATCH=25

# ===========================================
# SECURITY CONFIGURATION
# ===========================================
ENABLE_HTTPS=false
SESSION_SECRET=your-secure-random-string-here
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# ===========================================
# LOGGING CONFIGURATION
# ===========================================
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# ===========================================
# ADVANCED CONFIGURATION
# ===========================================
ENABLE_MEMORY_OPTIMIZATION=true
MAX_EMAILS_IN_MEMORY=10000
EMAIL_CHUNK_SIZE=5000
ADAPTIVE_DELAY_ENABLED=true
SMTP_OPTIMIZATION_ENABLED=true
```

### 4. Gmail Setup (Required)

#### Generate App Password
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification**
3. Scroll down to **App passwords**
4. Click **App passwords**
5. Select **Mail** as the app
6. Choose **Other (custom name)** and enter "HR Emailer"
7. Click **Generate**
8. Copy the 16-character password
9. Use this password in your `.env` file as `EMAIL_PASSWORD`

**Important Notes:**
- Never use your regular Gmail password
- App passwords are specific to each application
- Keep your app password secure and don't share it

## ⚙️ Configuration Details

### Email Configuration
```javascript
// server/src/config/email.js
const emailConfig = {
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  },
  // Connection settings
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
};
```

### File Upload Configuration
```javascript
// server/src/config/multer.js
const multerConfig = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 2 // Max 2 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow Excel files and PDFs
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
      'application/pdf'
    ];
    // ... validation logic
  }
};
```

## 🏃 Running the Server

### Development Mode
```bash
npm run dev
```
- Uses nodemon for auto-restart
- Enables detailed logging
- Runs on port 5000 by default

### Production Mode
```bash
npm start
```
- Optimized for production
- Minimal logging
- Uses PM2 or similar process manager recommended

### Server URLs
- **API Base**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/health`
- **API Status**: `http://localhost:5000/api/status`
- **Client URL**: Configured via `CLIENT_URL` environment variable

## 📚 API Documentation

### Email Endpoints

#### Send Emails
```http
POST /api/send-emails
Content-Type: multipart/form-data

# Request Body (Form Data):
- file: Excel/CSV file with recipient data
- resume: PDF resume file (optional)
- userEmail: Your email address
- campaignType: 'immediate' | 'multi-day'
- delayMs: Delay between emails in milliseconds
- templateId: Template ID to use
- resumeDocLink: Link to resume document (optional)
- manualRecipients: JSON string of manual recipients (alternative to file)
```

**Response:**
```json
{
  "success": true,
  "message": "Multi-day campaign created successfully",
  "campaignId": "campaign_123",
  "totalEmails": 150,
  "estimatedDays": 1,
  "type": "campaign",
  "templateUsed": "Job Search Template"
}
```

#### Verify Email Configuration
```http
POST /api/email/verify
```

**Response:**
```json
{
  "success": true,
  "message": "Email configuration is valid",
  "details": {
    "smtpConnection": "successful",
    "authentication": "successful"
  }
}
```

#### Get Email Logs
```http
GET /api/emails/logs?page=1&limit=50
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log_123",
      "campaignId": "campaign_456",
      "recipient": "hr@company.com",
      "company": "Tech Corp",
      "status": "sent",
      "sentAt": "2024-01-15T10:30:00Z",
      "error": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "pages": 5
  }
}
```

### Campaign Endpoints

#### Get All Campaigns
```http
GET /api/campaigns
```

#### Create Campaign
```http
POST /api/campaigns
Content-Type: application/json

{
  "name": "Q1 Job Applications",
  "contacts": [
    {"email": "hr@company.com", "company_name": "Tech Corp"}
  ],
  "template": "email template content",
  "delay": 10000,
  "userEmail": "your@email.com"
}
```

### Template Endpoints

#### Get All Templates
```http
GET /api/templates/templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": "job-search",
      "name": "Job Search",
      "category": "job-search",
      "description": "Professional template for job applications",
      "variables": ["company_name"],
      "subject": "Software Developer Opportunity | {{company_name}}",
      "content": "Dear Hiring Manager...",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

## 📁 File Upload Handling

### Supported File Types
- **Excel Files**: `.xlsx`, `.xls`, `.ods`
- **CSV Files**: `.csv`
- **PDF Files**: `.pdf` (for resumes)

### File Structure Requirements

#### Excel/CSV Format
Your spreadsheet must contain at least these columns:

| Company Name | Email Address |
|--------------|---------------|
| TechCorp Inc | hr@techcorp.com |
| StartupXYZ   | jobs@startupxyz.com |
| BigTech Ltd  | careers@bigtech.com |

**Alternative Column Names:**
- Company: `Company`, `Company Name`, `Company_Name`, `Organization`
- Email: `Email`, `Email Address`, `Email_Address`, `Contact Email`

### File Size Limits
- **Excel/CSV**: 5MB maximum
- **PDF Resume**: 5MB maximum
- **Total per request**: 10MB

## 📧 Email Configuration

### Gmail SMTP Settings
```javascript
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: '16-character-app-password'
  }
}
```

### Rate Limiting
- **Per Second**: 5 emails
- **Per Minute**: 50 emails
- **Per Hour**: 500 emails
- **Per Day**: 300 emails (configurable)

### Batch Processing
- **Default Batch Size**: 25 emails
- **Default Delay**: 10 seconds between emails
- **Adaptive Delays**: Automatically adjusts based on success/failure rates

## 🛡️ Security Features

### Authentication & Authorization
- Email configuration validation
- Request rate limiting
- CORS protection
- Input sanitization

### File Security
- File type validation
- Size limit enforcement
- Virus scanning (recommended)
- Automatic cleanup of temporary files

### Data Protection
- Environment variable encryption
- Sensitive data sanitization
- Error message filtering
- Secure logging

### Network Security
- HTTPS support (configurable)
- Security headers via Helmet
- XSS protection
- CSRF protection

## 🔧 Troubleshooting

### Common Issues

#### 1. Gmail Authentication Failed
**Error:** `Invalid login: 535-5.7.8 Username and Password not accepted`

**Solutions:**
- Verify 2-Step Verification is enabled
- Generate a new App Password
- Check that you're using the App Password, not your regular password
- Ensure no spaces in the App Password

#### 2. File Upload Errors
**Error:** `File type not allowed` or `File too large`

**Solutions:**
- Check file extension matches allowed types
- Ensure file size is under 5MB
- Verify Excel file is not corrupted
- Try saving Excel file in .xlsx format

#### 3. Port Already in Use
**Error:** `EADDRINUSE: address already in use`

**Solutions:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=5001
```

#### 4. CORS Errors
**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solutions:**
- Add your client URL to `CORS_ORIGINS` in `.env`
- Restart the server after configuration changes
- Check that `CLIENT_URL` matches your frontend URL

#### 5. Memory Issues
**Error:** `JavaScript heap out of memory`

**Solutions:**
- Enable memory optimization: `ENABLE_MEMORY_OPTIMIZATION=true`
- Reduce chunk size: `EMAIL_CHUNK_SIZE=2500`
- Increase Node.js memory limit: `node --max-old-space-size=1024 server.js`

### Debug Mode
Enable detailed logging for troubleshooting:

```bash
# Set environment variables
DEBUG=email-service:* npm run dev
NODE_ENV=development npm run dev
```

### Log Files
Check these locations for logs:
- `server/logs/application.log`
- `server/logs/email.log`
- `server/logs/error.log`
- Console output in development mode

### Health Checks
Use these endpoints to verify server status:
- `GET /health` - Basic health check
- `GET /api/status` - Detailed server status
- `POST /api/email/verify` - Email configuration test

## 📊 Monitoring & Analytics

### Server Metrics
- Request count and response times
- Email sending statistics
- Error rates and types
- Memory usage and performance

### Campaign Analytics
- Success/failure rates
- Average send times
- Bounce rates
- Geographic distribution

### Real-time Monitoring
- Socket.IO connection status
- Live campaign progress
- Email delivery confirmations
- Error notifications

## 🔄 Maintenance

### Regular Tasks
1. **Monitor Logs**: Check error logs daily
2. **Clean Uploads**: Remove old files weekly
3. **Update Dependencies**: Monthly security updates
4. **Backup Data**: Regular campaign data backups

### Performance Optimization
- Enable gzip compression
- Use connection pooling
- Implement caching where appropriate
- Monitor memory usage

---

For more information, see the main project README or contact the development team.
