const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  recipients: [{
    email: {
      type: String,
      required: true
    },
    companyName: {
      type: String,
      default: ''
    },
    success: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  totalSent: {
    type: Number,
    default: 0
  },
  totalFailed: {
    type: Number,
    default: 0
  }
}, { _id: false });

const campaignSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'failed', 'deleted'],
    default: 'active'
  },
  contacts: [{
    email: {
      type: String,
      required: true
    },
    company_name: {
      type: String,
      default: ''
    }
  }],
  template: {
    type: String,
    required: true
  },
  templateId: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  resumeDocLink: {
    type: String,
    default: ''
  },
  userEmail: {
    type: String,
    required: true
  },
  totalEmails: {
    type: Number,
    required: true
  },
  sentEmails: {
    type: Number,
    default: 0
  },
  failedEmails: {
    type: Number,
    default: 0
  },
  dailyLogs: [dailyLogSchema],
  delay: {
    type: Number,
    default: 10000 // 10 seconds
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastProcessedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Indexes for performance
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ userEmail: 1 });
campaignSchema.index({ createdAt: -1 });

// Pre-save middleware to update updatedAt
campaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
campaignSchema.methods.getProgress = function() {
  return {
    id: this.id,
    name: this.name,
    status: this.status,
    totalEmails: this.totalEmails,
    sentEmails: this.sentEmails,
    failedEmails: this.failedEmails,
    progress: this.totalEmails > 0 ? Math.round((this.sentEmails / this.totalEmails) * 100) : 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    lastProcessedAt: this.lastProcessedAt,
    completedAt: this.completedAt
  };
};

campaignSchema.methods.getEstimatedCompletion = function() {
  if (this.status !== 'active' || this.sentEmails >= this.totalEmails) {
    return null;
  }

  const remainingEmails = this.totalEmails - this.sentEmails;
  const avgDelay = this.delay || 10000; // Default 10 seconds
  const estimatedMs = remainingEmails * avgDelay;

  return new Date(Date.now() + estimatedMs);
};

campaignSchema.methods.updateProgress = function(successCount, failedCount) {
  this.sentEmails += successCount;
  this.failedEmails += failedCount;
  this.lastProcessedAt = new Date();

  if (this.sentEmails + this.failedEmails >= this.totalEmails) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
};

campaignSchema.methods.addDailyLog = function(logData) {
  const today = new Date().toISOString().split('T')[0];
  let dailyLog = this.dailyLogs.find(log => log.date === today);

  if (!dailyLog) {
    dailyLog = {
      date: today,
      recipients: [],
      totalSent: 0,
      totalFailed: 0
    };
    this.dailyLogs.push(dailyLog);
  }

  if (logData.recipients) {
    dailyLog.recipients.push(...logData.recipients);
    dailyLog.totalSent += logData.recipients.filter(r => r.success).length;
    dailyLog.totalFailed += logData.recipients.filter(r => !r.success).length;
  }
};

campaignSchema.methods.getNextBatch = function(batchSize = 25) {
  const processedEmails = new Set();

  // Collect all processed emails from daily logs
  this.dailyLogs.forEach(log => {
    log.recipients.forEach(recipient => {
      processedEmails.add(recipient.email);
    });
  });

  // Find unprocessed contacts
  const unprocessedContacts = this.contacts.filter(contact =>
    !processedEmails.has(contact.email)
  );

  return unprocessedContacts.slice(0, batchSize);
};

campaignSchema.methods.isValid = function() {
  const errors = [];

  if (!this.name || this.name.trim().length === 0) {
    errors.push('Campaign name is required');
  }

  if (!this.contacts || this.contacts.length === 0) {
    errors.push('At least one contact is required');
  }

  if (!this.template || this.template.trim().length === 0) {
    errors.push('Email template is required');
  }

  if (!this.subject || this.subject.trim().length === 0) {
    errors.push('Email subject is required');
  }

  if (!this.userEmail || !this.userEmail.includes('@')) {
    errors.push('Valid user email is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Static methods
campaignSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

campaignSchema.statics.getActiveCampaigns = function() {
  return this.findByStatus('active');
};

campaignSchema.statics.getCompletedCampaigns = function() {
  return this.findByStatus('completed');
};

campaignSchema.statics.getCampaignsByUser = function(userEmail) {
  return this.find({ userEmail }).sort({ createdAt: -1 });
};

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
