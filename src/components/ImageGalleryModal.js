import ImageView from 'react-native-image-viewing';

// Fullscreen viewer for post and comment images
// react-native-image-viewing — pinch zoom, double-tap zoom, swipe to dismiss, multi-image paging
// Our screens use expo-image while this library uses RN's built-in Image internally — both handle the same URIs
export default function ImageGalleryModal({ visible, images, initialIndex = 0, onClose }) {
  if (!images || images.length === 0) return null;

  // ImageView expects an array of { uri: '...' } objects
  const formatted = images.map((img) => ({
    uri: typeof img === 'string' ? img : img?.uri,
  }));

  return (
    <ImageView
      images={formatted}
      imageIndex={initialIndex}
      visible={visible}
      onRequestClose={onClose}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      presentationStyle="overFullScreen"
    />
  );
}
