import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import App from './App.jsx';
import './index.css';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
