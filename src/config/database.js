const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.campaignsPath = path.join(__dirname, '../../data/campaigns.json');
    this.initDatabase();
  }

  initDatabase() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.campaignsPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize campaigns file if it doesn't exist
      if (!fs.existsSync(this.campaignsPath)) {
        fs.writeFileSync(this.campaignsPath, JSON.stringify([], null, 2));
        console.log('📁 Campaigns database initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing database:', error);
    }
  }

  readCampaigns() {
    try {
      const data = fs.readFileSync(this.campaignsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error reading campaigns:', error);
      return [];
    }
  }

  writeCampaigns(campaigns) {
    try {
      fs.writeFileSync(this.campaignsPath, JSON.stringify(campaigns, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Error writing campaigns:', error);
      return false;
    }
  }

  findCampaignById(id) {
    const campaigns = this.readCampaigns();
    return campaigns.find(campaign => campaign.id === id);
  }

  updateCampaign(id, updates) {
    const campaigns = this.readCampaigns();
    const index = campaigns.findIndex(campaign => campaign.id === id);
    
    if (index !== -1) {
      campaigns[index] = { ...campaigns[index], ...updates };
      this.writeCampaigns(campaigns);
      return campaigns[index];
    }
    
    return null;
  }

  addCampaign(campaign) {
    const campaigns = this.readCampaigns();
    campaigns.push(campaign);
    this.writeCampaigns(campaigns);
    return campaign;
  }

  getActiveCampaigns() {
    const campaigns = this.readCampaigns();
    return campaigns.filter(campaign => campaign.status === 'active');
  }

  getAllCampaigns() {
    return this.readCampaigns();
  }
}

module.exports = new Database();
