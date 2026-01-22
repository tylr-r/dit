import { DitGlassSegmentedControl } from 'dit-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type GlassSegmentedControlProps = {
  values: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export const GlassSegmentedControl = ({
  values,
  selectedIndex,
  onChange,
  style,
}: GlassSegmentedControlProps) => {
  return (
    <View style={[styles.container, style]}>
      <DitGlassSegmentedControl
        style={StyleSheet.absoluteFill}
        items={values}
        selectedIndex={selectedIndex}
        onValueChange={(e) => {
          onChange(e.nativeEvent.value);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 32, // Standard iOS segmented control height
    width: 200, // Default width
  },
  nativeControl: {
    flex: 1,
  },
});
