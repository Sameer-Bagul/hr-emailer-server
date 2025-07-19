import React from 'react';
import { Mail, Wifi, WifiOff } from 'lucide-react';

const Header = ({ isConnected }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Mail size={24} />
          HR Outreach Emailer
        </div>
        
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
          {isConnected ? (
            <>
              <Wifi size={16} />
              Connected
            </>
          ) : (
            <>
              <WifiOff size={16} />
              Disconnected
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
