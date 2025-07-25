import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importa el CSS global
import App from './App'; // Importa tu componente principal App

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
    <App />
    </React.StrictMode>
);
