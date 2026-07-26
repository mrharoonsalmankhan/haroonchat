import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import IncomingCallModal from './components/calls/IncomingCallModal';
import CallScreen from './components/calls/CallScreen';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <IncomingCallModal />
      <CallScreen />
    </BrowserRouter>
  );
}

export default App;