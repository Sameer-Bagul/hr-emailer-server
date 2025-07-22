const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Test completion notification
router.post('/test-completion/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    const result = await schedulerService.testCompletionNotification(campaignId);
    
    res.json({
      success: true,
      message: `Completion notification test sent for campaign ${campaignId}`,
      result
    });
  } catch (error) {
    logger.error(`Error testing completion notification: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Test daily report
router.post('/test-daily-report', async (req, res) => {
  try {
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    const result = await schedulerService.testDailyReport();
    
    res.json({
      success: true,
      message: 'Daily report test sent',
      ...result
    });
  } catch (error) {
    logger.error(`Error testing daily report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger evening report
router.post('/trigger-evening-report', async (req, res) => {
  try {
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    await schedulerService.sendEveningStatusReport();
    
    res.json({
      success: true,
      message: 'Evening status report triggered successfully'
    });
  } catch (error) {
    logger.error(`Error triggering evening report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
