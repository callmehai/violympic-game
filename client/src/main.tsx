import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { applyTheme } from './theme';

// Hỏi server theme nào đang bật, gắn vào <html> RỒI mới render.
// body bị ẩn tới khi có data-theme (xem index.css) nên không loé theme sai.
applyTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
