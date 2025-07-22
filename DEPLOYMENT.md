# HR Outreach Emailer - Deployment Guide

## Backend Deployment (Render)

### Prerequisites
1. GitHub repository with your code
2. Gmail account with App Password generated

### Step 1: Deploy Backend to Render
1. Go to [Render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Configure:
   - **Root Directory**: `server` (if needed)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: 18 or higher

### Step 2: Environment Variables (Render Dashboard)
Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
CLIENT_URL=https://your-frontend-domain.netlify.app
EMAIL=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
MAIN_USER_EMAIL=your-email@gmail.com
MAX_FILE_SIZE=10485760
DAILY_EMAIL_LIMIT=300
DEBUG=false
```

### Step 3: Get Your Backend URL
After deployment, you'll get a URL like:
`https://your-app-name.onrender.com`

## Frontend Deployment (Netlify/Vercel)

### For React Frontend:
1. Deploy to Netlify or Vercel
2. Set environment variable:
   ```
   REACT_APP_SERVER_URL=https://your-backend-app.onrender.com
   ```

### Update CORS
After frontend deployment, update the `CLIENT_URL` environment variable in Render with your actual frontend URL.

## Important Notes

### Gmail Setup
1. Enable 2-Factor Authentication
2. Generate App Password (not your regular password)
3. Use App Password in `EMAIL_PASS` environment variable

### File Uploads
- Max file size: 10MB
- Supported formats: .xlsx, .xls, .pdf
- Files are temporarily stored and auto-deleted

### Daily Email Limits
- Maximum 300 emails per day (Gmail safe limit)
- Business hours: 9 AM - 9 PM
- Daily summary reports at 9 AM
- Evening reports at 9 PM

### Health Check
Your backend will be available at:
- Health check: `https://your-backend-url.onrender.com/health`
- API status: `https://your-backend-url.onrender.com/api/status`

## Troubleshooting

### Common Issues:
1. **CORS errors**: Make sure `CLIENT_URL` matches your frontend domain exactly
2. **Email not sending**: Verify Gmail App Password and enable less secure apps
3. **File upload errors**: Check file size limits and formats
4. **Scheduler not working**: Verify timezone settings

### Support
- Check logs in Render dashboard
- Use health check endpoint to verify server status
- Monitor daily email limits in status endpoint
