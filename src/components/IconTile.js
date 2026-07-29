// 소프트 배경 타일 + Ionicons — 이모지 대체 공통 컴포넌트
// 사용: <IconTile icon={BOARD_ICONS.free} size={46} />
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function IconTile({ icon, size = 46, radius = 12, style }) {
  if (!icon) return null;
  return (
    <View
      style={[{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: icon.color + '1A', // ~10% 소프트 틴트
        alignItems: 'center',
        justifyContent: 'center',
      }, style]}
    >
      <Ionicons name={icon.ion} size={Math.round(size * 0.5)} color={icon.color} />
    </View>
  );
}
