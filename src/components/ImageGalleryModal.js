import ImageView from 'react-native-image-viewing';

// 게시글/댓글 이미지 풀스크린 뷰어
// react-native-image-viewing — 핀치 줌, 더블탭 줌, 스와이프 닫기, 다중 이미지 페이지
// 우리 화면이 expo-image를 쓰지만 이 라이브러리는 RN의 기본 Image를 내부적으로 씀 — 둘 다 동일 URI 동작
export default function ImageGalleryModal({ visible, images, initialIndex = 0, onClose }) {
  if (!images || images.length === 0) return null;

  // ImageView는 { uri: '...' } 객체 배열을 받음
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
