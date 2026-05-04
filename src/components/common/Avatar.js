import { View, StyleSheet } from 'react-native'
import { Image } from 'expo-image';
import { Text } from '../StyledText';

// 닉네임 첫 글자로 색상 결정 (팔레트 순환)
const COLOR_PALETTE = [
  '#7F77DD',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
];

function getColorFromNickname(nickname) {
  if (!nickname) return COLOR_PALETTE[0];
  let sum = 0;
  for (let i = 0; i < nickname.length; i++) {
    sum += nickname.charCodeAt(i);
  }
  return COLOR_PALETTE[sum % COLOR_PALETTE.length];
}

// 재사용 아바타 컴포넌트 - uri가 있으면 이미지 표시, 없으면 색상 원/글자
export default function Avatar({ nickname, uri, size = 40, style, showLetter = false }) {
  const bgColor = getColorFromNickname(nickname);
  const firstChar = nickname ? nickname.charAt(0).toUpperCase() : '?';
  const fontSize = Math.floor(size * 0.4);

  const base = [
    styles.circle,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: bgColor,
    },
    style,
  ];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={base}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        accessibilityLabel="Profile picture"
      />
    );
  }

  return (
    <View style={base}>
      {showLetter && (
        <Text style={[styles.letter, { fontSize }]}>{firstChar}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
