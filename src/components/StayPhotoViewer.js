// Fullscreen photo viewer — tap a detail photo to enlarge it (swipe left/right). Pure JS, so OTA-safe.
import { useState, useRef, useEffect } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { Image } from 'expo-image';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';

export default function StayPhotoViewer({ visible, images = [], index = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');
  const scrollRef = useRef(null);
  const [cur, setCur] = useState(index);

  // Jump to the starting index when opened
  useEffect(() => {
    if (visible) {
      setCur(index);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: index * W, animated: false }));
    }
  }, [visible, index, W]);

  if (!images.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden={visible} />
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCur(Math.round(e.nativeEvent.contentOffset.x / W))}
        >
          {images.map((url) => (
            <TouchableOpacity key={url} activeOpacity={1} onPress={onClose} style={{ width: W, height: H }}>
              <Image source={{ uri: url }} style={{ width: W, height: H }} contentFit="contain" />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Close */}
        <TouchableOpacity style={[styles.close, { top: insets.top + 8 }]} activeOpacity={0.8} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={[styles.counter, { bottom: insets.bottom + 20 }]}>
            <Text style={styles.counterText}>{cur + 1} / {images.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  close: {
    position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  counter: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14,
  },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
