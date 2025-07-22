const DateUtils = require('../utils/dateUtils');
const logger = require('../utils/logger');

class Campaign {
  constructor(data) {
    this.id = data.id || DateUtils.generateId('camp_');
    this.name = data.name || `HR Outreach Campaign - ${DateUtils.formatDate(new Date(), 'localeDateString')}`;
    this.userEmail = data.userEmail;
    this.contacts = data.contacts || [];
    this.template = data.template;
    this.subject = data.subject;
    this.resumeDocLink = data.resumeDocLink;
    this.attachments = data.attachments || [];
    this.delay = data.delay || 10000;
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || DateUtils.getCurrentTimestamp();
    this.lastProcessed = data.lastProcessed || null;
    this.totalEmails = data.totalEmails || this.contacts.length;
    this.sentEmails = data.sentEmails || 0;
    this.failedEmails = data.failedEmails || 0;
    this.currentDay = data.currentDay || 1;
    this.currentBatch = data.currentBatch || 0;
    this.totalBatches = data.totalBatches || Math.ceil(this.totalEmails / 300);
    this.emailsSentToday = data.emailsSentToday || 0;
    this.dailyLogs = data.dailyLogs || [];
    this.completedAt = data.completedAt || null;
    this.lastProcessedAt = data.lastProcessedAt || null;
  }

  // Validation methods
  isValid() {
    const errors = [];

    if (!this.userEmail) {
      errors.push('User email is required');
    }

    if (!this.contacts || this.contacts.length === 0) {
      errors.push('At least one contact is required');
    }

    if (!this.template) {
      errors.push('Email template is required');
    }

    if (!this.subject) {
      errors.push('Email subject is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Business logic methods
  getNextBatch() {
    const dailyLimit = 300;
    const today = DateUtils.formatDate(new Date(), 'localeDateString');
    
    // Reset daily count if it's a new day
    const lastProcessedDate = this.lastProcessedAt 
      ? DateUtils.formatDate(new Date(this.lastProcessedAt), 'localeDateString')
      : null;
    
    if (lastProcessedDate !== today) {
      this.emailsSentToday = 0;
      this.currentDay++;
    }

    // Calculate remaining emails for today
    const remainingToday = dailyLimit - this.emailsSentToday;
    const totalRemaining = this.totalEmails - this.sentEmails;
    
    if (remainingToday <= 0 || totalRemaining <= 0) {
      return null;
    }

    // Get the next batch of contacts
    const batchSize = Math.min(remainingToday, totalRemaining);
    const startIndex = this.sentEmails;
    const endIndex = startIndex + batchSize;
    
    const batch = this.contacts.slice(startIndex, endIndex);
    
    logger.campaign(`Campaign ${this.name}: Preparing batch of ${batch.length} emails`);
    
    return {
      contacts: batch,
      batchNumber: this.currentBatch + 1,
      totalBatches: this.totalBatches,
      batchSize: batch.length
    };
  }

  updateProgress(successCount, failedCount) {
    this.sentEmails += successCount;
    this.failedEmails += failedCount;
    this.emailsSentToday += (successCount + failedCount);
    this.currentBatch++;
    this.lastProcessedAt = DateUtils.getCurrentTimestamp();

    // Check if campaign is completed
    if (this.sentEmails >= this.totalEmails) {
      this.status = 'completed';
      this.completedAt = DateUtils.getCurrentTimestamp();
    }

    logger.campaign(`Campaign ${this.name} progress updated: ${this.sentEmails}/${this.totalEmails} emails sent`);
  }

  addDailyLog(logData) {
    const today = DateUtils.formatDate(new Date(), 'localeDateString');
    
    const log = {
      date: today,
      timestamp: DateUtils.getCurrentTimestamp(),
      batchNumber: this.currentBatch,
      emailsSent: logData.emailsSent || 0,
      emailsFailed: logData.emailsFailed || 0,
      processingTime: logData.processingTime || 0,
      recipients: logData.recipients || []
    };

    this.dailyLogs.push(log);
    logger.campaign(`Daily log added for campaign ${this.name}`);
  }

  getProgress() {
    const progress = Math.round((this.sentEmails / this.totalEmails) * 100);
    return {
      campaignId: this.id,
      campaignName: this.name,
      status: this.status,
      totalEmails: this.totalEmails,
      sentEmails: this.sentEmails,
      failedEmails: this.failedEmails,
      progress,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      estimatedCompletion: this.getEstimatedCompletion()
    };
  }

  getEstimatedCompletion() {
    if (this.status === 'completed') {
      return this.completedAt;
    }

    const remainingEmails = this.totalEmails - this.sentEmails;
    const remainingDays = Math.ceil(remainingEmails / 300);
    return DateUtils.addDays(new Date(), remainingDays);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      userEmail: this.userEmail,
      contacts: this.contacts,
      template: this.template,
      subject: this.subject,
      resumeDocLink: this.resumeDocLink,
      attachments: this.attachments,
      delay: this.delay,
      status: this.status,
      createdAt: this.createdAt,
      lastProcessed: this.lastProcessed,
      totalEmails: this.totalEmails,
      sentEmails: this.sentEmails,
      failedEmails: this.failedEmails,
      currentDay: this.currentDay,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      emailsSentToday: this.emailsSentToday,
      dailyLogs: this.dailyLogs,
      completedAt: this.completedAt,
      lastProcessedAt: this.lastProcessedAt
    };
  }
}

module.exports = Campaign;
