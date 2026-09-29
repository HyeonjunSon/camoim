// Soft background tile + Ionicons — the shared component that replaced emoji
// Use: <IconTile icon={BOARD_ICONS.free} size={46} />
import { View } from 'react-native';
// The barrel ('@expo/vector-icons') bundles the fonts for all 19 icon sets — import Ionicons directly instead
import Ionicons from '@expo/vector-icons/Ionicons';

export default function IconTile({ icon, size = 46, radius = 12, style }) {
  if (!icon) return null;
  return (
    <View
      style={[{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: icon.color + '1A', // ~10% soft tint
        alignItems: 'center',
        justifyContent: 'center',
      }, style]}
    >
      <Ionicons name={icon.ion} size={Math.round(size * 0.5)} color={icon.color} />
    </View>
  );
}
