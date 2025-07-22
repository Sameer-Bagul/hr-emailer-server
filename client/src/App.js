import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';
import EmailForm from './components/EmailForm';
import EmailLogs from './components/EmailLogs';
import CampaignDashboard from './components/CampaignDashboard';
import Header from './components/Header';
import './App.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function App() {
  // eslint-disable-next-line no-unused-vars
  const [socket, setSocket] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [currentView, setCurrentView] = useState('form'); // 'form' or 'campaigns'

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('emailStatus', (data) => {
      setEmailLogs(prev => [...prev, data]);
      
      if (data.progress) {
        setProgress(data.progress);
      }
      
      if (data.type === 'complete') {
        setIsSending(false);
      }
    });

    // Listen for daily email status (multi-day campaigns)
    newSocket.on('dailyEmailStatus', (data) => {
      console.log('📨 Daily email status received:', data);
      setEmailLogs(prev => [...prev, data]);
      
      if (data.progress) {
        setProgress(data.progress);
      }
      
      if (data.type === 'complete') {
        setIsSending(false);
      }
    });

    // Listen for campaign progress updates
    newSocket.on('campaignProgress', (data) => {
      console.log('📈 Campaign progress received:', data);
      setEmailLogs(prev => [...prev, {
        type: 'info',
        message: `Campaign "${data.campaignName}": ${data.currentBatch}/${data.totalBatches} batches completed (${data.emailsSent}/${data.totalEmails} emails sent)`,
        progress: {
          current: data.emailsSent,
          total: data.totalEmails
        }
      }]);
      
      setProgress({
        current: data.emailsSent,
        total: data.totalEmails
      });
    });

    // Listen for campaign-specific progress updates
    newSocket.on('campaign-progress', (data) => {
      console.log('📊 Campaign-specific progress received:', data);
      setEmailLogs(prev => [...prev, {
        type: 'info',
        message: `📊 Campaign Progress: ${data.sent || 0}/${data.total || 0} emails sent`,
        progress: {
          current: data.sent || 0,
          total: data.total || 0
        }
      }]);
      
      setProgress({
        current: data.sent || 0,
        total: data.total || 0
      });
    });

    // Listen for individual email sent notifications
    newSocket.on('email-sent', (data) => {
      console.log('✅ Email sent notification:', data);
      setEmailLogs(prev => [...prev, {
        type: 'success',
        message: `✅ Email sent to ${data.data?.recipient || 'recipient'} (${data.data?.companyName || 'company'})`,
        timestamp: data.timestamp
      }]);
    });

    // Listen for individual email error notifications
    newSocket.on('email-error', (data) => {
      console.log('❌ Email error notification:', data);
      setEmailLogs(prev => [...prev, {
        type: 'error',
        message: `❌ Failed to send to ${data.data?.recipient || 'recipient'} (${data.data?.companyName || 'company'}): ${data.data?.message || 'Unknown error'}`,
        timestamp: data.timestamp
      }]);
    });

    // Listen for campaign completion
    newSocket.on('campaignCompleted', (data) => {
      console.log('🎉 Campaign completed:', data);
      setEmailLogs(prev => [...prev, {
        type: 'complete',
        message: `🎉 Campaign "${data.campaignName}" completed! ${data.totalEmailsSent} emails sent across ${data.totalBatches} batches.`
      }]);
      setIsSending(false);
    });

    // Listen for general email logs (ALL server logs)
    newSocket.on('emailLog', (data) => {
      console.log('📝 Email log received:', data);
      setEmailLogs(prev => [...prev, {
        type: data.type || 'info',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
    });

    // Listen for email status updates
    newSocket.on('emailStatus', (data) => {
      console.log('📊 Email status received:', data);
      setEmailLogs(prev => [...prev, {
        type: data.type || 'info',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
      
      if (data.progress) {
        setProgress(data.progress);
      }
    });

    // Listen for general notifications
    newSocket.on('notification', (data) => {
      console.log('🔔 Notification received:', data);
      setEmailLogs(prev => [...prev, {
        type: data.type || 'info',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
    });

    // Listen for server info logs (capture all server activity)
    newSocket.on('serverLog', (data) => {
      console.log('🔍 Server log received:', data);
      setEmailLogs(prev => [...prev, {
        type: data.level || 'info',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
    });

    // Listen for campaign-started events
    newSocket.on('campaign-started', (data) => {
      console.log('🚀 Campaign started event:', data);
      setEmailLogs(prev => [...prev, {
        type: 'info',
        message: `🚀 Campaign started: ${data.campaignName || data.name} (ID: ${data.campaignId || data.id})`,
        timestamp: data.timestamp || new Date().toISOString()
      }]);
    });

    setSocket(newSocket);
    
    // Make socket globally accessible for components
    window.socket = newSocket;

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendingStart = () => {
    setIsSending(true);
    setEmailLogs([{
      type: 'info',
      message: '🚀 Campaign started! Waiting for email processing to begin...'
    }]);
    setProgress(null);
  };

  const clearLogs = () => {
    setEmailLogs([]);
    setProgress(null);
  };

  return (
    <div className="App">
      <Toaster position="top-right" />
      <Header isConnected={isConnected} />
      
      {/* Navigation */}
      <nav className="main-nav">
        <div className="nav-container">
          <button 
            className={`nav-button ${currentView === 'form' ? 'active' : ''}`}
            onClick={() => setCurrentView('form')}
          >
            Create Campaign
          </button>
          <button 
            className={`nav-button ${currentView === 'campaigns' ? 'active' : ''}`}
            onClick={() => setCurrentView('campaigns')}
          >
            Campaign Dashboard
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        {currentView === 'form' ? (
          <div className="container">
            <EmailForm 
              onSendingStart={handleSendingStart}
              isSending={isSending}
            />
            
            <EmailLogs 
              logs={emailLogs}
              progress={progress}
              onClearLogs={clearLogs}
            />
          </div>
        ) : (
          <CampaignDashboard />
        )}
      </main>
    </div>
  );
}

export default App;
