# HR Outreach Emailer Server - MVC Architecture

## Overview

The HR Outreach Emailer server has been completely refactored to follow proper MVC (Model-View-Controller) architecture patterns. This ensures better maintainability, testability, and scalability.

## Architecture

### Directory Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # Database abstraction layer
│   │   └── email.js     # Email configuration
│   ├── controllers/     # HTTP request handlers
│   │   ├── campaignController.js
│   │   ├── emailController.js
│   │   └── templateController.js
│   ├── middleware/      # Express middleware
│   │   ├── errorHandler.js
│   │   ├── uploadMiddleware.js
│   │   └── validation.js
│   ├── models/          # Business logic models
│   │   ├── Campaign.js
│   │   ├── Email.js
│   │   └── Template.js
│   ├── routes/          # Route definitions
│   │   ├── campaignRoutes.js
│   │   ├── emailRoutes.js
│   │   └── templateRoutes.js
│   ├── services/        # Business logic services
│   │   ├── campaignService.js
│   │   ├── emailService.js
│   │   ├── fileService.js
│   │   ├── reportService.js
│   │   └── schedulerService.js
│   ├── sockets/         # Socket.IO handlers
│   │   └── emailSocket.js
│   ├── utils/           # Utility functions
│   │   ├── dateUtils.js
│   │   ├── fileUtils.js
│   │   └── logger.js
│   └── app.js           # Express app configuration
├── uploads/             # File upload storage
├── campaigns.json       # Campaign data storage
├── server.js            # Server entry point
└── package.json
```

## Components

### Models
- **Campaign.js**: Campaign business logic and validation
- **Email.js**: Email object model with validation
- **Template.js**: Email template management with Handlebars

### Controllers
- **campaignController.js**: Campaign HTTP request handling
- **emailController.js**: Email HTTP request handling  
- **templateController.js**: Template HTTP request handling

### Services
- **campaignService.js**: Campaign CRUD operations and business logic
- **emailService.js**: Email sending and batch processing
- **fileService.js**: Excel file parsing and validation
- **reportService.js**: Analytics and reporting
- **schedulerService.js**: Cron job management for automated campaigns

### Middleware
- **errorHandler.js**: Global error handling and logging
- **uploadMiddleware.js**: File upload handling with Multer
- **validation.js**: Request validation using express-validator

### Socket Handlers
- **emailSocket.js**: Real-time communication for campaign progress

### Configuration
- **database.js**: JSON file database abstraction
- **email.js**: Email service configuration

## Key Features

### 1. Separation of Concerns
- Clear separation between models, controllers, and services
- Middleware handles cross-cutting concerns
- Socket handlers manage real-time communication

### 2. Error Handling
- Comprehensive error handling throughout the application
- Structured error responses with proper HTTP status codes
- Centralized logging with different log levels

### 3. Validation
- Request validation using express-validator
- File type and size validation for uploads
- Business logic validation in models

### 4. Real-time Communication
- Socket.IO integration for real-time campaign progress
- Automatic progress updates during email sending
- Campaign completion notifications

### 5. Scheduled Tasks
- Automated daily campaign processing
- Cleanup tasks for old files and logs
- Campaign status monitoring

## API Endpoints

### Campaigns
```
GET    /api/campaigns           # Get all campaigns
POST   /api/campaigns           # Create new campaign
GET    /api/campaigns/:id       # Get campaign by ID
PUT    /api/campaigns/:id       # Update campaign
DELETE /api/campaigns/:id       # Delete campaign
POST   /api/campaigns/:id/start # Start campaign
POST   /api/campaigns/:id/pause # Pause campaign
GET    /api/campaigns/:id/report # Get campaign report
```

### Emails
```
POST   /api/emails/send         # Send single email
POST   /api/emails/bulk         # Send bulk emails
GET    /api/emails/logs         # Get email logs
GET    /api/emails/test         # Test email configuration
```

### Templates
```
GET    /api/templates           # Get all templates
POST   /api/templates           # Create template
GET    /api/templates/:id       # Get template by ID
PUT    /api/templates/:id       # Update template
DELETE /api/templates/:id       # Delete template
POST   /api/templates/:id/render # Render template with data
```

## Environment Variables

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Scheduling
DAILY_CAMPAIGN_TIME=9
CLEANUP_INTERVAL_HOURS=1
```

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Update email credentials and other settings

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

## Migration from Legacy Code

The original monolithic `index.js` structure has been completely refactored:

- **Before**: Single file with mixed concerns
- **After**: Modular MVC architecture with clear separation

### Key Improvements

1. **Maintainability**: Each component has a single responsibility
2. **Testability**: Services and models can be unit tested independently
3. **Scalability**: Easy to add new features and endpoints
4. **Error Handling**: Comprehensive error handling and logging
5. **Code Reusability**: Services can be reused across controllers
6. **Documentation**: Clear API structure and documentation

## Development Guidelines

### Adding New Features

1. **Models**: Add business logic and validation
2. **Services**: Implement data operations and business rules
3. **Controllers**: Handle HTTP requests and responses
4. **Routes**: Define API endpoints
5. **Middleware**: Add cross-cutting concerns if needed

### Testing

- Unit tests should focus on services and models
- Integration tests should test API endpoints
- Use the structured error handling for consistent responses

### Logging

Use the centralized logger for all logging:

```javascript
const logger = require('../utils/logger');

logger.info('Information message');
logger.warning('Warning message');
logger.error('Error message');
```

## Architecture Benefits

1. **Single Responsibility**: Each class/file has one clear purpose
2. **Dependency Injection**: Services can be easily mocked and tested
3. **Error Handling**: Consistent error handling across the application
4. **Logging**: Centralized logging with structured output
5. **Validation**: Comprehensive request and data validation
6. **Real-time Updates**: Socket.IO integration for live progress tracking
7. **Scheduled Tasks**: Automated campaign processing and cleanup

## Next Steps

1. Add comprehensive unit tests
2. Implement API documentation with Swagger
3. Add database migration system
4. Implement caching layer
5. Add monitoring and health checks
6. Consider microservices architecture for larger scale
