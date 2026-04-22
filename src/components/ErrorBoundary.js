import { Component } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './StyledText';

// React 클래스 컴포넌트 (ErrorBoundary는 클래스만 가능)
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

// 에러 발생 시 표시되는 화면
function ErrorFallback({ onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>😵</Text>
      <Text style={styles.title}>문제가 발생했어요</Text>
      <Text style={styles.desc}>
        예상치 못한 오류가 발생했습니다.{'\n'}앱을 다시 시작해주세요.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.btnText}>다시 시도</Text>
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
