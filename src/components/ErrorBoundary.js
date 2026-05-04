import { Component } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useLang } from '../context/LangContext';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }) {
  let t;
  try {
    ({ t } = useLang());
  } catch {
    t = (k) => k;
  }
  const safe = (key, fallback) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>😵</Text>
      <Text style={styles.title}>{safe('errorBoundary.title', 'Something went wrong')}</Text>
      <Text style={styles.desc}>
        {safe('errorBoundary.desc', 'An unexpected error occurred.\nPlease restart the app.')}
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.btnText}>{safe('errorBoundary.retry', 'Try Again')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
