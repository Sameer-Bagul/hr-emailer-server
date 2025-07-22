# HR Outreach Emailer API Endpoints

## 🆕 Modern API Endpoints (MVC Structure)

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create new campaign
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `GET /api/campaigns/:id/report` - Get campaign analytics

### Emails
- `POST /api/emails/send` - Send emails with file upload
- `POST /api/emails/verify` - Verify email configuration
- `POST /api/emails/estimate` - Estimate sending time

### Templates
- `GET /api/templates` - List all templates
- `POST /api/templates` - Create new template
- `GET /api/templates/:id` - Get template details
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/render` - Render template with data

## 🔄 Legacy Endpoints (Backward Compatibility)

### Email Sending (Original Frontend)
- `POST /api/send-emails` - Send emails (supports file upload)
  - Expects: Excel file (`file`), Resume PDF (`resume`), delay settings
  - Returns: Email sending progress

### Template Access
- `GET /api/template` - Get default email template
  - Returns: `{ template: "...", subject: "..." }`

## 🛠️ System Endpoints

- `GET /` - API documentation and endpoint list
- `GET /health` - Health check
- `GET /api/status` - Server statistics
- `GET /favicon.ico` - Favicon (prevents 404s)

## 🔌 Real-time Communication

### Socket.IO Events
- `campaign-progress` - Live campaign progress updates
- `email-sent` - Individual email success notifications
- `email-error` - Email sending error notifications
- `campaign-complete` - Campaign completion alerts

## 📝 Notes

- **Legacy Support**: All original endpoints work unchanged
- **New Features**: MVC structure adds comprehensive campaign management
- **File Uploads**: Supports Excel (.xlsx, .xls) and PDF files
- **Real-time**: Socket.IO provides live progress tracking
- **Validation**: All inputs are validated and sanitized
- **Error Handling**: Comprehensive error responses with proper HTTP codes
