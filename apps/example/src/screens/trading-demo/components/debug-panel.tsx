import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { maxLevels, minLevels } from '../model/presets';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface SegmentProperties<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

function Segment<T extends string>({ options, value, onChange }: SegmentProperties<T>) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.option, active ? styles.optionActive : styles.optionIdle]}
            onPress={() => onChange(option.value)}>
            <Text style={active ? styles.optionTextActive : styles.optionTextIdle}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const boostOptions: Option<'on' | 'off'>[] = [
  { label: 'Boost On', value: 'on' },
  { label: 'Boost Off', value: 'off' },
];

interface DebugPanelProperties {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: number;
  onLevelsChange: (levels: number) => void;
  onLevelsCommit: (levels: number) => void;
  boost: boolean;
  onBoostChange: (value: boolean) => void;
}

export function DebugPanel({
  open,
  onOpenChange,
  levels,
  onLevelsChange,
  onLevelsCommit,
  boost,
  onBoostChange,
}: DebugPanelProperties) {
  if (open) {
    return (
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Demo Controls</Text>
          <Pressable onPress={() => onOpenChange(false)} hitSlop={8}>
            <Text style={styles.collapse}>Hide</Text>
          </Pressable>
        </View>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Load</Text>
          <Slider
            style={styles.slider}
            minimumValue={minLevels}
            maximumValue={maxLevels}
            step={1}
            value={levels}
            onValueChange={onLevelsChange}
            onSlidingComplete={onLevelsCommit}
            minimumTrackTintColor="#f0b90b"
            maximumTrackTintColor="#2b3640"
            thumbTintColor="#eaecef"
          />
          <Text style={styles.sliderValue}>{levels}</Text>
        </View>
        <Segment
          options={boostOptions}
          value={boost ? 'on' : 'off'}
          onChange={(value) => onBoostChange(value === 'on')}
        />
      </View>
    );
  }

  return (
    <Pressable style={styles.fab} onPress={() => onOpenChange(true)}>
      <Text style={styles.fabText}>Controls</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(12, 16, 21, 0.96)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a3139',
    padding: 8,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eaecef',
  },
  collapse: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c7480',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 8,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c7480',
    width: 34,
  },
  slider: {
    flex: 1,
    height: 36,
  },
  sliderValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eaecef',
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#0b0e11',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: '#2b3640',
  },
  optionIdle: {
    backgroundColor: 'transparent',
  },
  optionTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f0b90b',
  },
  optionTextIdle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c7480',
  },
  fab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(12, 16, 21, 0.96)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a3139',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#eaecef',
  },
});
