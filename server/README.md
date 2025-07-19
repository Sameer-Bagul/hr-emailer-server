# 🚀 HR Emailer Server

Backend Node.js server for the HR Outreach Emailer application. Handles email sending, file uploads, real-time communication, and template processing.

## 🏗️ Architecture

### Core Components
- **Express.js Server** - REST API endpoints
- **Socket.IO** - Real-time progress updates
- **Nodemailer** - Gmail SMTP email sending
- **Multer** - File upload handling
- **Handlebars** - Email template compilation

### Key Files
- `index.js` - Main Express server and API routes
- `mailer.js` - Email sending logic and batch processing
- `parser.js` - Excel file parsing with XLSX
- `templateEngine.js` - Email template processing
- `fixed-template.txt` - Professional email template

## 📡 API Endpoints

### GET `/api/template`
Returns the fixed email template and subject line.

**Response:**
```json
{
  "template": "Dear Hiring Team at {{company_name}}...",
  "subject": "Opportunities in Software Development | {{company_name}}"
}
```

### POST `/send-emails`
Processes Excel file and sends personalized emails with optional resume attachments.

**Request:**
- `file` (multipart) - Excel file with company data
- `resume` (multipart, optional) - PDF resume file
- `delayMs` (form data) - Delay between emails in milliseconds
- `resumeDocLink` (form data, optional) - Google Doc resume link

**Response:**
```json
{
  "message": "Email sending started",
  "totalEmails": 25,
  "recipients": [
    {
      "company": "Microsoft",
      "email": "hr@microsoft.com"
    }
  ]
}
```

## 🔧 Environment Variables

Create a `.env` file in the server directory:

```env
# Email Configuration (Required)
EMAIL=your-email@gmail.com              # Your Gmail address
EMAIL_PASS=your-app-password            # 16-character Gmail app password

# Server Configuration (Optional)
PORT=5000                               # Server port (default: 5000)
NODE_ENV=development                    # Environment mode
DEBUG=false                             # Enable debug logging
```

## 📧 Email System

### Gmail SMTP Configuration
- **Service**: Gmail SMTP
- **Authentication**: App Password (16 characters)
- **Rate Limiting**: 10-second minimum delay between emails
- **Daily Limit**: 300 emails per day

### Email Features
- **Personalization**: Company name replacement in subject and body
- **HTML Formatting**: Rich HTML emails with professional styling
- **Resume Attachments**: Automatic PDF attachment
- **Google Doc Links**: Embedded resume links with styling
- **Error Handling**: Comprehensive error tracking and reporting

### Template Processing
```javascript
// Template compilation with Handlebars
const template = Handlebars.compile(templateContent);
const html = template({ 
  company_name: "Microsoft",
  email: "hr@microsoft.com" 
});
```

## 📁 File Upload System

### Multer Configuration
- **Storage**: Disk storage in `uploads/` directory
- **File Types**: Excel (.xlsx, .xls) and PDF files
- **Size Limits**: 5MB maximum file size
- **Validation**: Strict file type validation
- **Cleanup**: Automatic file deletion after processing

### Upload Structure
```
uploads/
├── 1642567890123-companies.xlsx        # Timestamped Excel files
├── 1642567890124-resume.pdf            # Timestamped resume files
└── (automatically cleaned up)
```

## 🔄 Real-time Communication

### Socket.IO Events

**Client → Server:**
- `connection` - Client connects to server

**Server → Client:**
- `emailStatus` - Progress updates during email sending

**Email Status Events:**
```javascript
// Success
{
  type: 'success',
  message: '✅ Email sent to Microsoft (hr@microsoft.com)',
  progress: {
    current: 5,
    total: 25,
    successCount: 4,
    failureCount: 1
  }
}

// Error
{
  type: 'error',
  message: '❌ Failed to send to Google: Authentication failed',
  progress: { /* ... */ }
}

// Completion
{
  type: 'complete',
  message: '🎉 Email campaign completed! Success: 24, Failed: 1',
  progress: { /* ... */ }
}
```

## 🗃️ Data Processing

### Excel File Requirements
The parser expects specific column names:
- `Company Name` or `Company` - Company name for personalization
- `Email` or `Email Address` - Recipient email address

### Processing Flow
1. **File Upload** - Multer receives and stores file
2. **Excel Parsing** - XLSX library extracts data
3. **Data Validation** - Email format and company name validation
4. **Deduplication** - Remove duplicate email addresses
5. **Batch Processing** - Send emails with configurable delays

### Email Validation
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = emailRegex.test(email);
```

## 🛡️ Security & Validation

### File Security
- **Type Validation**: Only Excel and PDF files accepted
- **Size Limits**: 5MB maximum to prevent abuse
- **Path Sanitization**: Secure file naming with timestamps
- **Automatic Cleanup**: Files deleted after processing

### Email Security
- **App Passwords**: Secure Gmail authentication
- **Rate Limiting**: Prevents spam detection
- **Input Sanitization**: All inputs validated before processing

### Error Handling
```javascript
try {
  // Email sending logic
} catch (error) {
  console.error('Email error:', error);
  io.emit('emailStatus', {
    type: 'error',
    message: `❌ Error: ${error.message}`
  });
}
```

## 📊 Performance Optimization

### Email Batching
- **Sequential Processing**: Emails sent one by one to avoid rate limits
- **Configurable Delays**: 5-60 second delays between emails
- **Memory Management**: Files cleaned up immediately after use
- **Error Recovery**: Failed emails don't stop the batch

### Resource Management
- **File Cleanup**: Automatic cleanup prevents disk space issues
- **Memory Usage**: Efficient stream processing for large Excel files
- **Connection Pooling**: Reuses transporter for entire batch

## 🔍 Debugging

### Enable Debug Mode
```env
DEBUG=true
NODE_ENV=development
```

### Log Levels
- **Info**: General application flow
- **Error**: Error conditions and failures
- **Debug**: Detailed execution information

### Common Debug Scenarios
```bash
# Check email credentials
node -e "require('./mailer').createTransporter().verify().then(console.log)"

# Test Excel parsing
node -e "require('./parser').parseExcelFile('./test.xlsx').then(console.log)"

# Verify template compilation
node -e "require('./templateEngine').compileTemplate('./fixed-template.txt', {company_name: 'Test'}).then(console.log)"
```

## 🧪 Testing

### Manual Testing
```bash
# Test email configuration
curl -X GET http://localhost:5000/api/template

# Test file upload (with test Excel file)
curl -X POST http://localhost:5000/send-emails \
  -F "file=@test-companies.xlsx" \
  -F "delayMs=5000"
```

### Error Simulation
- Invalid Excel files
- Missing email columns
- Invalid email addresses
- Large file uploads
- Gmail authentication failures

## 📦 Dependencies

### Core Dependencies
```json
{
  "express": "^4.18.2",           // Web framework
  "cors": "^2.8.5",               // Cross-origin requests
  "multer": "^1.4.5-lts.1",       // File uploads
  "nodemailer": "^6.9.8",         // Email sending
  "handlebars": "^4.7.8",         // Template engine
  "socket.io": "^4.7.4",          // Real-time communication
  "xlsx": "^0.18.5",              // Excel file processing
  "dotenv": "^16.3.1"             // Environment variables
}
```

### Development Dependencies
```json
{
  "nodemon": "^3.0.2"             // Development server
}
```

## 🚀 Deployment

### Environment Setup
1. Set all required environment variables
2. Ensure uploads directory exists
3. Configure Gmail App Password
4. Install production dependencies

### Production Considerations
- **Process Management**: Use PM2 or similar
- **File Permissions**: Ensure upload directory is writable
- **Memory Limits**: Monitor memory usage for large batches
- **Error Monitoring**: Implement error tracking service

### Docker Support (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔧 Maintenance

### Regular Tasks
- **Log Rotation**: Manage application logs
- **File Cleanup**: Monitor uploads directory
- **Dependency Updates**: Keep packages updated
- **Security Patches**: Apply security updates

### Monitoring
- **Email Success Rates**: Track delivery success
- **Error Patterns**: Monitor common failures
- **Performance Metrics**: Response times and throughput
- **Resource Usage**: CPU and memory monitoring

---

**Server ready for professional HR outreach campaigns! 🚀**
