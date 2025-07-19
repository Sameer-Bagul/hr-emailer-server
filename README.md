# 📧 HR Outreach Emailer

A professional MERN stack application for automated HR outreach email campaigns with resume attachment capabilities. Send personalized emails to multiple companies with your resume automatically attached.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-61dafb.svg)

## ✨ Features

### 🎯 Core Functionality
- **📊 Excel Import**: Upload Excel files with company names and email addresses
- **📝 Fixed Professional Template**: Pre-written HR outreach message with company personalization
- **📎 Resume Attachments**: Attach PDF resume and include Google Doc links
- **⚡ Real-time Progress**: Live progress tracking with Socket.IO
- **🔄 Smart Delays**: Configurable delays between emails (5-60 seconds)
- **📈 Success Tracking**: Track successful and failed email deliveries

### 🎨 User Interface
- **Modern Glassmorphism Design**: Beautiful, professional interface
- **📱 Responsive Layout**: Works on desktop and mobile devices
- **📋 Template Preview**: See how your emails will look before sending
- **🚨 Toast Notifications**: Real-time feedback for all actions
- **📊 Progress Visualization**: Visual progress bars and status updates

### 🔒 Security & Reliability
- **🔐 Gmail App Passwords**: Secure authentication with Gmail SMTP
- **📄 File Validation**: Strict file type and size validation
- **🧹 Automatic Cleanup**: Auto-cleanup of uploaded files
- **⚠️ Error Handling**: Comprehensive error handling and reporting

## 🏗️ Tech Stack

### Frontend
- **React 18.2.0** - Modern React with hooks
- **Axios** - HTTP client for API requests
- **Socket.IO Client** - Real-time communication
- **React Hook Form** - Form validation and handling
- **React Hot Toast** - Beautiful notifications
- **Lucide React** - Modern icon library
- **CSS3** - Custom styling with glassmorphism effects

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional communication
- **Nodemailer** - Email sending functionality
- **Handlebars** - Template engine for emails
- **Multer** - File upload handling
- **XLSX** - Excel file parsing
- **CORS** - Cross-origin resource sharing

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0
- Gmail account with App Password enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hr-emailer
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp server/.env.example server/.env
   
   # Edit the .env file with your Gmail credentials
   EMAIL=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

4. **Start the application**
   ```bash
   # Development mode (both server and client)
   npm run dev
   
   # Or start individually
   npm run server:dev  # Start server in development mode
   npm run client:dev  # Start client in development mode
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## 📧 Gmail Setup

### Enable App Passwords

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Settings](https://myaccount.google.com)
   - Security → 2-Step Verification → Turn On

2. **Generate App Password**
   - Security → 2-Step Verification → App passwords
   - Select "Mail" and your device
   - Copy the generated 16-character password

3. **Update Environment Variables**
   ```env
   EMAIL=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

## 📊 Excel File Format

Your Excel file should contain the following columns:

| Column Name | Description | Required |
|-------------|-------------|----------|
| `Company Name` or `Company` | Name of the company | ✅ Yes |
| `Email` or `Email Address` | Contact email address | ✅ Yes |

### Example Excel Structure:
```
Company Name    | Email
Microsoft       | hr@microsoft.com
Google          | careers@google.com
Apple           | jobs@apple.com
```

## 📎 Resume Attachments

### Supported Resume Formats
- **PDF Resume**: Attach PDF files (max 5MB)
- **Google Doc Link**: Include online resume links

### Resume Features
- **Automatic Attachment**: PDF resumes are attached to every email
- **Professional Formatting**: Google Doc links are beautifully formatted in emails
- **File Validation**: Strict PDF validation and size limits
- **Smart Cleanup**: Automatic file cleanup after sending

## 🎨 Template System

### Fixed Professional Template
The application uses a pre-written professional HR outreach template that includes:

- **Personalized Greeting**: Company-specific addressing
- **Professional Introduction**: Software developer introduction
- **Skills Showcase**: Technical skills and experience
- **Portfolio Links**: GitHub and project showcases
- **Resume Integration**: Automatic resume attachment and links
- **Call to Action**: Professional closing with contact information

### Template Variables
- `{{company_name}}`: Automatically replaced with company name from Excel
- Dynamic subject line: "Opportunities in Software Development | Company Name"

## 🔄 Email Campaign Process

1. **📊 Upload Excel File**: Select your company contact list
2. **📎 Add Resume**: Upload PDF and/or add Google Doc link
3. **⏱️ Set Delay**: Configure delay between emails (5-60 seconds)
4. **👁️ Preview**: Review your email template and subject
5. **🚀 Send Campaign**: Start automated email sending
6. **📈 Monitor Progress**: Watch real-time progress and results

## 📝 Available Scripts

### Root Directory
```bash
npm run dev           # Start both server and client in development
npm run start         # Start production server
npm run server:dev    # Start server in development mode
npm run server:start  # Start production server
npm run client:dev    # Start client in development mode
npm run client:build  # Build client for production
npm run install:all   # Install dependencies for all packages
```

### Server (./server)
```bash
npm start            # Start production server
npm run dev          # Start development server with nodemon
```

### Client (./client)
```bash
npm start            # Start development server
npm run build        # Build for production
npm test             # Run tests
```

## 📁 Project Structure

```
hr-emailer/
├── client/                 # React frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── EmailForm.js    # Main form component
│   │   │   ├── EmailLogs.js    # Progress tracking
│   │   │   └── Header.js       # App header
│   │   ├── App.js         # Main app component
│   │   ├── App.css        # Global styles
│   │   └── index.js       # App entry point
│   └── package.json       # Client dependencies
├── server/                # Node.js backend
│   ├── uploads/           # Temporary file storage
│   ├── index.js           # Express server
│   ├── mailer.js          # Email sending logic
│   ├── parser.js          # Excel parsing
│   ├── templateEngine.js  # Email template processing
│   ├── fixed-template.txt # Email template
│   ├── .env.example       # Environment variables template
│   └── package.json       # Server dependencies
├── examples/              # Demo files and documentation
├── package.json           # Root package configuration
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables (server/.env)
```env
# Email Configuration
EMAIL=your-email@gmail.com              # Your Gmail address
EMAIL_PASS=your-app-password            # Gmail app password (16 characters)

# Server Configuration (optional)
PORT=5000                               # Server port (default: 5000)
```

### Email Limits
- **Daily Limit**: 300 emails per day (Gmail limit)
- **Batch Size**: Processes all emails in Excel file (max 300)
- **Delay Range**: 5-60 seconds between emails
- **File Size**: Max 5MB for resume attachments

## 🐛 Troubleshooting

### Common Issues

**1. "Authentication failed" error**
- Ensure 2FA is enabled on your Gmail account
- Generate a new App Password
- Use the 16-character app password (not your regular password)

**2. "Excel file format error"**
- Ensure columns are named exactly: "Company Name" or "Company"
- Ensure email column is named: "Email" or "Email Address"
- Save file as .xlsx or .xls format

**3. "Resume file too large"**
- PDF files must be under 5MB
- Compress your PDF if needed

**4. Port conflicts**
- Server runs on port 5000, client on port 3000
- Change ports in package.json if conflicts occur

### Debug Mode
Enable debug logging by setting:
```env
DEBUG=true
```

## 📈 Performance

- **Email Rate**: Respects Gmail's rate limits
- **File Processing**: Efficient Excel parsing with XLSX library
- **Memory Usage**: Automatic file cleanup prevents memory leaks
- **Real-time Updates**: Socket.IO for instant progress feedback

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Nodemailer** - Email sending functionality
- **React** - Frontend framework
- **Socket.IO** - Real-time communication
- **Handlebars** - Template engine
- **Lucide** - Beautiful icons

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section
2. Review the Gmail setup instructions
3. Ensure all dependencies are installed correctly
4. Verify environment variables are set properly

---

**Made with ❤️ for efficient HR outreach campaigns**
