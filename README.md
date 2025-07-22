# 🚀 HR Emailer Server - MVC Architecture

Modern, clean backend server for the HR Outreach Emailer application built with proper MVC architecture.

## 🏗️ Clean Architecture

### Directory Structure
```
server/
├── src/                 # All source code
│   ├── config/         # Configuration files
│   ├── controllers/    # HTTP request handlers
│   ├── middleware/     # Express middleware
│   ├── models/         # Business logic models
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic services
│   ├── sockets/        # Real-time communication
│   └── utils/          # Utility functions
├── uploads/            # File storage
├── campaigns.json      # Campaign data
├── server.js          # Application entry point
└── package.json       # Dependencies
```

### Core Technologies
- **Express.js** - REST API framework
- **Socket.IO** - Real-time communication
- **Nodemailer** - Email sending via Gmail SMTP
- **Multer** - Secure file upload handling
- **Handlebars** - Email template engine
- **Node-cron** - Automated scheduling
- **Express-validator** - Request validation

## 📡 Clean API Structure

### Campaigns
```
GET    /api/campaigns           # List all campaigns
POST   /api/campaigns           # Create new campaign  
GET    /api/campaigns/:id       # Get campaign details
PUT    /api/campaigns/:id       # Update campaign
DELETE /api/campaigns/:id       # Delete campaign
POST   /api/campaigns/:id/start # Start campaign
POST   /api/campaigns/:id/pause # Pause campaign
GET    /api/campaigns/:id/report # Get campaign analytics
```

### Emails
```
POST   /api/emails/send         # Send single email
POST   /api/emails/bulk         # Send bulk emails
GET    /api/emails/logs         # Get email logs
POST   /api/emails/test         # Test email config
POST   /api/emails/verify       # Verify email setup
POST   /api/emails/estimate     # Estimate sending time
```

### Templates  
```
GET    /api/templates           # List templates
POST   /api/templates           # Create template
GET    /api/templates/:id       # Get template
PUT    /api/templates/:id       # Update template
DELETE /api/templates/:id       # Delete template
POST   /api/templates/:id/render # Render with data
## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create `.env` file:
```env
# Email Configuration
EMAIL=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password

# Server Configuration  
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 3. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## ✨ Key Features

- **🏗️ MVC Architecture** - Clean, maintainable code structure
- **📧 Smart Email Sending** - Batch processing with rate limiting
- **📊 Real-time Progress** - Socket.IO live updates
- **📅 Automated Scheduling** - Cron jobs for campaign management
- **🔒 Secure File Uploads** - Validation and sanitization
- **📈 Analytics & Reports** - Comprehensive campaign insights
- **🚨 Error Handling** - Structured error responses
- **� Request Validation** - Input validation and sanitization

## 🔧 Configuration

The server automatically handles:
- ✅ Email configuration validation
- ✅ File upload security
- ✅ Rate limiting compliance  
- ✅ Real-time progress tracking
- ✅ Automated cleanup tasks
- ✅ Comprehensive logging

## 📱 Real-time Features

Socket.IO events:
- `campaign-progress` - Live sending progress
- `email-sent` - Individual email notifications  
- `email-error` - Error notifications
- `campaign-complete` - Completion alerts

## 🛡️ Security & Validation

- File type validation (Excel, PDF only)
- File size limits (5MB max)
- Email address validation
- Request rate limiting
- Input sanitization
