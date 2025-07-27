const Campaign = require('./src/models/Campaign');
const CampaignService = require('./src/services/campaignService');
const logger = require('./src/utils/logger');

async function testCampaignCreation() {
  try {
    console.log('=== Testing Campaign Creation ===');
    
    const campaignData = {
      name: 'Test Campaign',
      userEmail: 'test@example.com',
      contacts: [
        { email: 'recipient@test.com', company_name: 'Test Company' }
      ],
      template: 'Hello {{company_name}}, test message.',
      subject: 'Test Subject'
    };
    
    console.log('1. Creating Campaign instance directly...');
    const directCampaign = new Campaign(campaignData);
    console.log(`Direct campaign ID: ${directCampaign.id}`);
    
    console.log('2. Creating campaign via service...');
    const campaignService = new CampaignService();
    const serviceCampaign = await campaignService.createCampaign(campaignData);
    console.log(`Service campaign ID: ${serviceCampaign?.id}`);
    
    console.log('3. Testing toJSON preservation...');
    const json = serviceCampaign.toJSON();
    console.log(`JSON ID: ${json.id}`);
    
    console.log('4. Creating Campaign from JSON...');
    const fromJson = new Campaign(json);
    console.log(`From JSON ID: ${fromJson.id}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCampaignCreation();
