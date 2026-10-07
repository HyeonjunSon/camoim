// A pure-JS "spin and snap" number wheel (no native picker installed, so it stays OTA-safe).
// Scroll, let go, and the nearest row to the centre band becomes the pick; Confirm commits it.
import { useRef, useState } from 'react';
import { Modal, View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './StyledText';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LangContext';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5; // Odd, so one row sits dead centre
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

// values: array of selectable values (any type, stringified for display unless formatLabel is given)
// initialValue: pre-selects this value on open (falls back to the middle of the list)
export default function WheelPicker({ visible, title, values, initialValue, formatLabel, onSelect, onClose, accentColor }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = createStyles(colors);
  const listRef = useRef(null);
  const accent = accentColor || colors.primary;

  const initialIndex = Math.max(0, values.indexOf(initialValue));
  const [index, setIndex] = useState(initialIndex === -1 ? 0 : initialIndex);

  const onMomentumScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setIndex(Math.max(0, Math.min(values.length - 1, i)));
  };

  const confirm = () => {
    onSelect(values[index]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {!!title && <Text style={styles.sheetTitle}>{title}</Text>}

          <View style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
            <View style={[styles.selectionBar, { top: PAD, borderColor: accent }]} pointerEvents="none" />
            <FlatList
              ref={listRef}
              data={values}
              keyExtractor={(v) => String(v)}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
              initialScrollIndex={index}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              contentContainerStyle={{ paddingVertical: PAD }}
              onMomentumScrollEnd={onMomentumScrollEnd}
              renderItem={({ item, index: i }) => {
                const selected = i === index;
                return (
                  <View style={styles.row}>
                    <Text style={[styles.rowText, selected && { color: colors.text, fontWeight: '800', fontSize: 19 }]}>
                      {formatLabel ? formatLabel(item) : String(item)}
                    </Text>
                  </View>
                );
              }}
            />
          </View>

          <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: accent }]} activeOpacity={0.9} onPress={confirm}>
            <Text style={styles.confirmText}>{t('common.confirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  selectionBar: { position: 'absolute', left: 0, right: 0, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1 },
  row: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontSize: 16, color: colors.textSecondary },
  confirmBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
