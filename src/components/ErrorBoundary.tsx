import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Screen, ScreenTitle, ScreenSubtitle } from './ui/Screen';
import { Button } from './ui/Button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the app tree:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <Screen>
          <ScreenTitle>Something went wrong</ScreenTitle>
          <ScreenSubtitle>
            That's on us, not you. Try again, or head back and pick up where you left off.
          </ScreenSubtitle>
          <div className="flex flex-col gap-2">
            <Button onClick={this.handleRetry}>Try again</Button>
            <Button variant="secondary" onClick={() => (window.location.href = '/')}>
              Back home
            </Button>
          </div>
        </Screen>
      );
    }
    return this.props.children;
  }
}
