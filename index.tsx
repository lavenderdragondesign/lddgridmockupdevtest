import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { error: any }> {
  state = { error: null as any };
  constructor(props: any) { super(props); }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error('Runtime error:', error, info); }
  render() {
    if (this.state.error) {
      return <div style={{padding:16,fontFamily:'monospace',whiteSpace:'pre-wrap'}}>
        <h2>💥 App crashed</h2>
        <div>{String(this.state.error)}</div>
      </div>;
    }
    return this.props.children as any;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </React.StrictMode>
);
