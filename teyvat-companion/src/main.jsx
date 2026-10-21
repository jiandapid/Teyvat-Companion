import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Teyvat Companion render error:', error, info?.componentStack || '');
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-shell">
          <div className="app-error-panel">
            <div className="app-error-mark">✦</div>
            <p className="eyebrow">TEYVAT COMPANION</p>
            <h1>That screen ran into a problem.</h1>
            <p>Your saved tracker data is still stored in this browser. Reload the app to recover the interface. If this keeps happening, export your tracker backup after it opens again.</p>
            <button type="button" className="button primary" onClick={() => window.location.reload()}>Reload Teyvat Companion</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
