import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCrash } from '@/lib/crashReporter';
import { EL, Radii, Space, Type } from '@/theme/emeraldLedger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    void recordCrash({
      type: 'boundary',
      message: error.message,
      stack: error.stack,
      context: info.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>!</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: EL.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
  },
  emoji: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.nippu,
    marginBottom: Space.md,
  },
  title: { ...Type.displaySm, marginBottom: Space.sm },
  message: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    marginBottom: Space.xl,
  },
  button: {
    backgroundColor: EL.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radii.md,
  },
  buttonText: { ...Type.labelLg, color: EL.white },
});
