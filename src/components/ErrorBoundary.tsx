import * as React from "react";
import { Component } from "react";

type State = { hasError: boolean; error: Error | null };
type Props = { children: React.ReactNode };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // You can log to an error reporting service here
    // console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#c00" }}>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
