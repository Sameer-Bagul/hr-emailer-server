const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  campaignId: {
    type: String,
    required: true,
    index: true
  },
  recipient: {
    email: {
      type: String,
      required: true
    },
    companyName: {
      type: String,
      default: ''
    }
  },
  template: {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    }
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending', 'bounced', 'complained'],
    default: 'pending'
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      default: 0
    },
    contentType: {
      type: String,
      default: 'application/octet-stream'
    }
  }],
  metadata: {
    userAgent: String,
    ipAddress: String,
    userEmail: String,
    batchId: String,
    smtpResponse: String,
    messageId: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
emailSchema.index({ campaignId: 1, status: 1 });
emailSchema.index({ 'recipient.email': 1 });
emailSchema.index({ status: 1, sentAt: -1 });
emailSchema.index({ createdAt: -1 });
emailSchema.index({ sentAt: -1 });

// Pre-save middleware to update updatedAt
emailSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
emailSchema.methods.markAsSent = function(messageId = null, smtpResponse = null) {
  this.status = 'sent';
  this.sentAt = new Date();
  if (messageId) {
    this.metadata.messageId = messageId;
  }
  if (smtpResponse) {
    this.metadata.smtpResponse = smtpResponse;
  }
  return this.save();
};

emailSchema.methods.markAsFailed = function(error, incrementRetry = true) {
  if (incrementRetry) {
    this.retryCount += 1;
  }

  if (this.retryCount >= this.maxRetries) {
    this.status = 'failed';
    this.failedAt = new Date();
  }

  this.error = error;
  return this.save();
};

emailSchema.methods.markAsDelivered = function() {
  this.status = 'sent'; // Keep as sent, but mark delivery
  this.deliveredAt = new Date();
  return this.save();
};

emailSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && this.status !== 'sent';
};

emailSchema.methods.getTimeToSend = function() {
  if (!this.sentAt) return null;
  return this.sentAt - this.createdAt;
};

// Static methods
emailSchema.statics.findByCampaign = function(campaignId) {
  return this.find({ campaignId }).sort({ createdAt: -1 });
};

emailSchema.statics.findByRecipient = function(email) {
  return this.find({ 'recipient.email': email }).sort({ createdAt: -1 });
};

emailSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

emailSchema.statics.getSentEmails = function(campaignId = null) {
  const query = { status: 'sent' };
  if (campaignId) {
    query.campaignId = campaignId;
  }
  return this.find(query).sort({ sentAt: -1 });
};

emailSchema.statics.getFailedEmails = function(campaignId = null) {
  const query = { status: 'failed' };
  if (campaignId) {
    query.campaignId = campaignId;
  }
  return this.find(query).sort({ failedAt: -1 });
};

emailSchema.statics.getPendingEmails = function(campaignId = null) {
  const query = { status: 'pending' };
  if (campaignId) {
    query.campaignId = campaignId;
  }
  return this.find(query).sort({ createdAt: -1 });
};

emailSchema.statics.getEmailStats = function(campaignId = null) {
  const matchStage = campaignId ? { campaignId } : {};

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRetries: { $sum: '$retryCount' }
      }
    }
  ]);
};

emailSchema.statics.getEmailsByDateRange = function(startDate, endDate, campaignId = null) {
  const matchStage = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (campaignId) {
    matchStage.campaignId = campaignId;
  }

  return this.find(matchStage).sort({ createdAt: -1 });
};

emailSchema.statics.cleanupOldEmails = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['sent', 'failed'] }
  });
};

const Email = mongoose.model('Email', emailSchema);

module.exports = Email;
