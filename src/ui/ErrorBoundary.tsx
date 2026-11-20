import { Component, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

/**
 * Catches a part of the interface that failed to load or render, so it shows a way out instead of
 * taking the whole page down. Progress is saved as you play, so reloading loses nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; whole?: boolean }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={this.props.whole ? 'crash is-whole' : 'crash'} role="alert">
        <p className="crash-title">This part of AISim didn't load.</p>
        <p className="crash-text">Usually that means a new version was just released. Reload to get it; your progress is saved.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <RotateCw size={14} aria-hidden /> Reload
        </button>
      </div>
    );
  }
}
