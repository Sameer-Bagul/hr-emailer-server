import React from 'react';
import { Activity, Trash2, CheckCircle, XCircle, Clock, BarChart3, Info, Zap } from 'lucide-react';

const EmailLogs = ({ logs, progress, onClearLogs }) => {
  const getLogIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} />;
      case 'error':
        return <XCircle size={16} />;
      case 'complete':
        return <BarChart3 size={16} />;
      case 'info':
        return <Info size={16} />;
      case 'daily':
        return <Zap size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getLogClassName = (type) => {
    return `log-item log-${type}`;
  };

  const formatLogMessage = (log) => {
    const timestamp = new Date().toLocaleTimeString();
    return `[${timestamp}] ${log.message}`;
  };

  const progressPercentage = progress 
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="email-logs">
      <div className="logs-header">
        <div className="logs-title">
          <Activity size={24} />
          Email Campaign Progress
        </div>
        {logs.length > 0 && (
          <button 
            onClick={onClearLogs}
            className="clear-button"
            title="Clear logs"
          >
            <Trash2 size={16} />
            Clear Logs
          </button>
        )}
      </div>

      {progress && (
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          <div className="progress-stats">
            <div className="progress-stat">
              <div className="stat-value">{progress.current}</div>
              <div className="stat-label">Processed</div>
            </div>
            <div className="progress-stat">
              <div className="stat-value">{progress.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="progress-stat">
              <div className="stat-value" style={{ color: '#22c55e' }}>
                {progress.successCount || 0}
              </div>
              <div className="stat-label">Success</div>
            </div>
            <div className="progress-stat">
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {progress.failureCount || 0}
              </div>
              <div className="stat-label">Failed</div>
            </div>
            <div className="progress-stat">
              <div className="stat-value">{progressPercentage}%</div>
              <div className="stat-label">Complete</div>
            </div>
          </div>
        </div>
      )}

      <div className="logs-container">
        {logs.length === 0 ? (
          <div className="empty-logs">
            <Activity className="empty-logs-icon" />
            <p>No email activity yet. Upload an Excel file and start your campaign!</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index} 
              className={getLogClassName(log.type)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getLogIcon(log.type)}
                {formatLogMessage(log)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EmailLogs;
