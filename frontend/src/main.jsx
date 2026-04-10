import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomerDisplayScreen from './components/POS/CustomerDisplayScreen';
import './index.css';

function isCustomerDisplayMode() {
  try {
    return new URLSearchParams(window.location.search).get('display') === 'customer';
  } catch (error) {
    return false;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  isCustomerDisplayMode() ? <CustomerDisplayScreen /> : <App />
);
