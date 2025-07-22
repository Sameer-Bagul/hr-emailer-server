import React, { useState, useEffect } from 'react';
import { Calendar, Mail, TrendingUp, Clock, CheckCircle, AlertCircle, BarChart3 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './CampaignDashboard.css';

const CampaignDashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  useEffect(() => {
    loadCampaigns();
    // Set up polling for real-time updates
    const interval = setInterval(loadCampaigns, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await axios.get('/api/campaigns');
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetails = async (campaignId) => {
    try {
      const response = await axios.get(`/api/campaign/${campaignId}`);
      setSelectedCampaign(response.data);
    } catch (error) {
      console.error('Error loading campaign details:', error);
      toast.error('Failed to load campaign details');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <TrendingUp className="status-icon active" size={20} />;
      case 'completed':
        return <CheckCircle className="status-icon completed" size={20} />;
      case 'paused':
        return <AlertCircle className="status-icon paused" size={20} />;
      default:
        return <Clock className="status-icon pending" size={20} />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateEstimatedCompletion = (campaign) => {
    if (campaign.status === 'completed') return 'Completed';
    
    const remainingEmails = campaign.totalEmails - campaign.sentEmails;
    const remainingDays = Math.ceil(remainingEmails / 300);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + remainingDays);
    
    return formatDate(completionDate);
  };

  if (loading) {
    return (
      <div className="campaign-dashboard loading">
        <div className="loading-spinner">
          <BarChart3 size={48} className="spinner" />
          <p>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-dashboard">
      <div className="dashboard-header">
        <h1>
          <BarChart3 size={32} />
          Campaign Dashboard
        </h1>
        <p>Monitor your email campaigns and their progress</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="no-campaigns">
          <Mail size={64} />
          <h2>No campaigns found</h2>
          <p>Start by creating your first email campaign from the main form.</p>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-header">
                <div className="campaign-title">
                  <h3>{campaign.name}</h3>
                  <div className="campaign-status">
                    {getStatusIcon(campaign.status)}
                    <span className={`status-text ${campaign.status}`}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="campaign-stats">
                <div className="stat">
                  <Mail size={16} />
                  <span className="stat-label">Total Emails:</span>
                  <span className="stat-value">{campaign.totalEmails}</span>
                </div>
                
                <div className="stat">
                  <CheckCircle size={16} />
                  <span className="stat-label">Sent:</span>
                  <span className="stat-value">{campaign.sentEmails}</span>
                </div>

                <div className="stat">
                  <TrendingUp size={16} />
                  <span className="stat-label">Progress:</span>
                  <span className="stat-value">{campaign.progress}%</span>
                </div>

                <div className="stat">
                  <Calendar size={16} />
                  <span className="stat-label">Created:</span>
                  <span className="stat-value">{formatDate(campaign.createdAt)}</span>
                </div>

                <div className="stat">
                  <Clock size={16} />
                  <span className="stat-label">Est. Completion:</span>
                  <span className="stat-value">{calculateEstimatedCompletion(campaign)}</span>
                </div>
              </div>

              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${campaign.progress}%` }}
                ></div>
              </div>

              <button
                className="details-button"
                onClick={() => loadCampaignDetails(campaign.id)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedCampaign && (
        <div className="campaign-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedCampaign.name}</h2>
              <button 
                className="close-button"
                onClick={() => setSelectedCampaign(null)}
              >
                ×
              </button>
            </div>
            
            <div className="campaign-details">
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Campaign ID:</strong>
                  <span>{selectedCampaign.id}</span>
                </div>
                
                <div className="detail-item">
                  <strong>Status:</strong>
                  <span className={`status ${selectedCampaign.status}`}>
                    {selectedCampaign.status.charAt(0).toUpperCase() + selectedCampaign.status.slice(1)}
                  </span>
                </div>
                
                <div className="detail-item">
                  <strong>Total Emails:</strong>
                  <span>{selectedCampaign.totalEmails}</span>
                </div>
                
                <div className="detail-item">
                  <strong>Emails Sent:</strong>
                  <span>{selectedCampaign.sentEmails}</span>
                </div>
                
                <div className="detail-item">
                  <strong>Failed Emails:</strong>
                  <span>{selectedCampaign.failedEmails}</span>
                </div>
                
                <div className="detail-item">
                  <strong>Current Day:</strong>
                  <span>{selectedCampaign.currentDay} of {selectedCampaign.totalDays}</span>
                </div>
                
                <div className="detail-item">
                  <strong>Progress:</strong>
                  <span>{selectedCampaign.progress}%</span>
                </div>
                
                <div className="detail-item">
                  <strong>Created:</strong>
                  <span>{formatDate(selectedCampaign.createdAt)}</span>
                </div>
                
                {selectedCampaign.lastProcessed && (
                  <div className="detail-item">
                    <strong>Last Processed:</strong>
                    <span>{formatDate(selectedCampaign.lastProcessed)}</span>
                  </div>
                )}
              </div>
              
              <div className="progress-section">
                <h3>Progress Overview</h3>
                <div className="large-progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${selectedCampaign.progress}%` }}
                  ></div>
                  <span className="progress-text">{selectedCampaign.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDashboard;
