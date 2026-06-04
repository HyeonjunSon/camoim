import { useRef, useState, useEffect } from 'react';
import {
  View,
  Modal,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';

// 게시글/댓글 이미지 풀스크린 뷰어
// - 가로 스와이프로 이미지 간 이동
// - iOS: ScrollView 네이티브 핀치줌 (maximumZoomScale)
// - Android: 줌 없음 — 다음 빌드에서 PinchGestureHandler 도입 가능
// - 상단: N / M 카운터 + 닫기 버튼
export default function ImageGalleryModal({ visible, images, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const listRef = useRef(null);
  const [screenSize, setScreenSize] = useState(() => Dimensions.get('window'));

  // 회전 시 너비 재계산
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenSize(window));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  if (!images || images.length === 0) return null;

  const onScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenSize.width);
    if (idx !== currentIndex) setCurrentIndex(idx);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(item, idx) => `${idx}_${typeof item === 'string' ? item.slice(-20) : 'img'}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: screenSize.width,
            offset: screenSize.width * index,
            index,
          })}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width: screenSize.width, height: screenSize.height }}
              contentContainerStyle={styles.zoomContainer}
              maximumZoomScale={Platform.OS === 'ios' ? 3 : 1}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
              pinchGestureEnabled
            >
              <Image
                source={{ uri: typeof item === 'string' ? item : item?.uri }}
                style={{ width: screenSize.width, height: screenSize.height }}
                contentFit="contain"
                transition={0}
              />
            </ScrollView>
          )}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  zoomContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
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
  counterWrap: { flex: 1, alignItems: 'center', marginLeft: 36 /* close 버튼 너비 보정 */ },
  counterText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
});
