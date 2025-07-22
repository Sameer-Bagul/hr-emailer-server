const express = require('express');
const CampaignController = require('../controllers/campaignController');

const router = express.Router();

// Create controller instance
const campaignController = new CampaignController();

// GET /api/campaigns - Get all campaigns
router.get('/', campaignController.getAllCampaigns.bind(campaignController));

// GET /api/campaigns/summary - Get campaigns summary
router.get('/summary', campaignController.getCampaignsSummary.bind(campaignController));

// POST /api/campaigns/trigger - Manually trigger campaign processing
router.post('/trigger', campaignController.triggerCampaignProcessing.bind(campaignController));

// POST /api/campaigns/trigger-summary - Manually trigger daily summary
router.post('/trigger-summary', campaignController.triggerDailySummary.bind(campaignController));

// POST /api/campaigns/trigger-evening-report - Manually trigger evening report
router.post('/trigger-evening-report', campaignController.triggerEveningReport.bind(campaignController));

// POST /api/campaigns - Create new campaign
router.post('/', campaignController.createCampaign.bind(campaignController));

// GET /api/campaign/:id - Get campaign by ID
router.get('/:id', campaignController.getCampaignById.bind(campaignController));

// GET /api/campaign/:id/stats - Get campaign statistics
router.get('/:id/stats', campaignController.getCampaignStats.bind(campaignController));

// PUT /api/campaign/:id - Update campaign
router.put('/:id', campaignController.updateCampaign.bind(campaignController));

// POST /api/campaign/:id/pause - Pause campaign
router.post('/:id/pause', campaignController.pauseCampaign.bind(campaignController));

// POST /api/campaign/:id/resume - Resume campaign
router.post('/:id/resume', campaignController.resumeCampaign.bind(campaignController));

// DELETE /api/campaign/:id - Delete campaign
router.delete('/:id', campaignController.deleteCampaign.bind(campaignController));

module.exports = router;
