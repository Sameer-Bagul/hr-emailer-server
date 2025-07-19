import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';
import EmailForm from './components/EmailForm';
import EmailLogs from './components/EmailLogs';
import Header from './components/Header';
import './App.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(null);

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

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendingStart = () => {
    setIsSending(true);
    setEmailLogs([]);
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
      
      <main className="main-content">
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
      </main>
    </div>
  );
}

export default App;
