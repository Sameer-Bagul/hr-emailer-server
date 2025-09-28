const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.campaignsPath = path.join(__dirname, '../../data/campaigns.json');
    this.isWriting = false; // Prevent concurrent writes
    this.writeQueue = []; // Queue for pending writes
    this.cache = null; // In-memory cache
    this.cacheTimeout = 5000; // Cache timeout in ms
    this.lastCacheUpdate = 0;
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
      
      // Load initial cache
      this.refreshCache();
    } catch (error) {
      console.error('❌ Error initializing database:', error);
    }
  }

  // Refresh cache from file
  refreshCache() {
    try {
      const data = fs.readFileSync(this.campaignsPath, 'utf8');
      this.cache = JSON.parse(data);
      this.lastCacheUpdate = Date.now();
      return this.cache;
    } catch (error) {
      console.error('❌ Error refreshing cache:', error);
      this.cache = [];
      return this.cache;
    }
  }

  // Check if cache is still valid
  isCacheValid() {
    return this.cache !== null && (Date.now() - this.lastCacheUpdate) < this.cacheTimeout;
  }

  readCampaigns() {
    try {
      // Use cache if valid
      if (this.isCacheValid()) {
        return [...this.cache]; // Return copy to prevent mutations
      }
      
      // Refresh cache and return
      return this.refreshCache();
    } catch (error) {
      console.error('❌ Error reading campaigns:', error);
      return [];
    }
  }

  // Thread-safe write with queue
  async writeCampaigns(campaigns) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ campaigns, resolve, reject });
      this.processWriteQueue();
    });
  }

  // Process write queue to prevent race conditions
  async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    
    try {
      while (this.writeQueue.length > 0) {
        const { campaigns, resolve, reject } = this.writeQueue.shift();
        
        try {
          // Create backup before writing
          const backupPath = this.campaignsPath + '.backup';
          if (fs.existsSync(this.campaignsPath)) {
            fs.copyFileSync(this.campaignsPath, backupPath);
          }
          
          // Write to temporary file first
          const tempPath = this.campaignsPath + '.tmp';
          fs.writeFileSync(tempPath, JSON.stringify(campaigns, null, 2));
          
          // Atomic move
          fs.renameSync(tempPath, this.campaignsPath);
          
          // Update cache
          this.cache = [...campaigns];
          this.lastCacheUpdate = Date.now();
          
          // Clean up backup after successful write
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          
          resolve(true);
        } catch (error) {
          console.error('❌ Error writing campaigns:', error);
          
          // Restore from backup if available
          const backupPath = this.campaignsPath + '.backup';
          if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, this.campaignsPath);
            fs.unlinkSync(backupPath);
          }
          
          reject(error);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  findCampaignById(id) {
    const campaigns = this.readCampaigns();
    return campaigns.find(campaign => campaign.id === id);
  }

  async updateCampaign(id, updates) {
    const campaigns = this.readCampaigns();
    const index = campaigns.findIndex(campaign => campaign.id === id);
    
    if (index !== -1) {
      campaigns[index] = { ...campaigns[index], ...updates };
      await this.writeCampaigns(campaigns);
      return campaigns[index];
    }
    
    return null;
  }

  async addCampaign(campaign) {
    console.log(`[DATABASE] Adding campaign with ID: ${campaign.id}`);
    const campaigns = this.readCampaigns();
    campaigns.push(campaign);
    await this.writeCampaigns(campaigns);
    console.log(`[DATABASE] Campaign added successfully with ID: ${campaign.id}`);
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
