import { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Gallery from 'react-native-awesome-gallery';
import { Text } from './StyledText';

// 게시글/댓글 이미지 풀스크린 뷰어
// react-native-awesome-gallery 사용 — Reanimated + GestureHandler 기반
// - 핀치 줌 (iOS + Android 둘 다)
// - 더블탭 줌
// - 줌 상태에서 패닝
// - 가로 스와이프로 다음/이전 이미지
// - 아래로 스와이프하면 자동 닫기
export default function ImageGalleryModal({ visible, images, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  if (!images || images.length === 0) return null;

  // gallery는 문자열 배열 또는 객체 배열 받음 — 우리는 URI 문자열만
  const galleryImages = images.map((img) => (typeof img === 'string' ? img : img?.uri));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <GestureHandlerRootView style={styles.container}>
        <Gallery
          data={galleryImages}
          initialIndex={initialIndex}
          onIndexChange={(idx) => setCurrentIndex(idx)}
          onSwipeToClose={onClose}
          loop={false}
        />

        {/* 상단 헤더 — 카운터 + 닫기 */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.counterWrap} pointerEvents="none">
            {images.length > 1 && (
              <Text style={styles.counterText}>{currentIndex + 1} / {images.length}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  counterWrap: { flex: 1, alignItems: 'center', marginLeft: 36 },
  counterText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
});
