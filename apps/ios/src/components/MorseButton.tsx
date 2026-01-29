import { Canvas, RoundedRect, Shader, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type MorseButtonProps = {
  isPressing: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
};

type LayoutSize = {
  width: number;
  height: number;
};

const SWIRL_SHADER_SOURCE = `
  uniform float iTime;
  uniform vec2 iResolution;

  const float PI = 3.14159265;

  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  half4 main(vec2 fragCoord) {
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);

    float t = iTime * (2.0 * PI / 10.0);

    uv += vec2(0.15 * cos(t), 0.15 * sin(t));
    uv *= rotate2d(0.8);

    for (float i = 1.0; i < 4.5; i++) {
      uv.x += 0.5 / i * sin(i * 1.6 * uv.y + t);
      uv.y += 0.5 / i * cos(i * 1.7 * uv.x + t + 1.5);
    }

    float r = 0.6 + 0.4 * sin(uv.x + t);
    float g = 0.6 + 0.4 * sin(uv.y + t + 2.0);
    float b = 0.9 + 0.2 * sin(uv.x + uv.y);

    vec3 col = vec3(r, g, b);
    col = mix(col, vec3(1.0), 0.1);

    float shine = max(0.0, dot(normalize(col), vec3(0.577)));
    col += pow(shine, 8.0) * 0.4;

    return half4(col, 1.0);
  }
`;

const SWIRL_RUNTIME_EFFECT = Skia.RuntimeEffect.Make(SWIRL_SHADER_SOURCE);

function useLayoutSize() {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (__DEV__) {
      console.info('[MorseButton] layout', { width, height });
    }
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  };

  return { layout, onLayout };
}

type MorseLiquidSurfaceProps = {
  speedMultiplier?: number;
};

function MorseLiquidSurface({ speedMultiplier = 1 }: MorseLiquidSurfaceProps) {
  const { layout, onLayout } = useLayoutSize();
  const hasLoggedRenderReady = useRef(false);
  const hasLoggedWaiting = useRef(false);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    if (hasLoggedWaiting.current) {
      return;
    }
    if (layout.width === 0 || layout.height === 0) {
      console.info('[MorseButton] waiting for layout');
      hasLoggedWaiting.current = true;
    }
  }, [layout.height, layout.width]);
  const radius = useMemo(() => layout.height / 2, [layout.height]);
  const buttonRect = useMemo(() => {
    if (layout.width === 0 || layout.height === 0) {
      return null;
    }
    return Skia.XYWHRect(0, 0, layout.width, layout.height);
  }, [layout.width, layout.height]);

  const buttonRRect = buttonRect
    ? Skia.RRectXY(buttonRect, radius, radius)
    : null;
  const time = useSharedValue(0);

  // Use a shared value for speed and animate it with withTiming in useEffect
  const speed = useSharedValue(speedMultiplier);
  useEffect(() => {
    speed.value = withTiming(speedMultiplier, { duration: 100 });
  }, [speedMultiplier, speed]);

  const speedValue = useDerivedValue(() => speed.value, [speed]);


  useFrameCallback((frameInfo) => {
    if (frameInfo.timeSincePreviousFrame === null) {
      return;
    }
    time.value =
      (time.value + (frameInfo.timeSincePreviousFrame / 1000) * speedValue.value) %
      10;
  });

  const uniforms = useDerivedValue(() => {
    const width = Math.max(layout.width, 1);
    const height = Math.max(layout.height, 1);
    return {
      iTime: time.value,
      iResolution: [width, height],
    };
  }, [layout.width, layout.height]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    if (layout.width === 0 || layout.height === 0) {
      return;
    }
    if (hasLoggedRenderReady.current) {
      return;
    }
    hasLoggedRenderReady.current = true;
    console.info('[MorseButton] render-ready', {
      width: layout.width,
      height: layout.height,
      radius,
      runtimeEffect: Boolean(SWIRL_RUNTIME_EFFECT),
    });
  }, [layout.height, layout.width, radius]);

  if (!buttonRect || !buttonRRect || !SWIRL_RUNTIME_EFFECT) {
    return <View style={styles.morseSurface} onLayout={onLayout} />;
  }

  return (
    <View style={styles.morseSurface} onLayout={onLayout}>
      <Canvas
        style={{ width: layout.width, height: layout.height }}
        pointerEvents="none"
      >
        <RoundedRect rect={buttonRRect}>
          <Shader source={SWIRL_RUNTIME_EFFECT} uniforms={uniforms} />
        </RoundedRect>
      </Canvas>
    </View>
  );
}

/** Tap/press input button for dot/dah entry. */
export function MorseButton({
  isPressing,
  onPressIn,
  onPressOut,
}: MorseButtonProps) {
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Tap for dot, hold for dah"
      style={styles.morsePressable}
    >
      {({ pressed }) => {
        const isActive = pressed || isPressing;
        return (
          <View style={[styles.morseWrap, isActive && styles.morseWrapPressed]}>
            <MorseLiquidSurface speedMultiplier={isActive ? 2 : 0.5} />
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  morsePressable: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  morseWrap: {
    width: '100%',
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1 }],
  },
  morseWrapPressed: {
    transform: [{ scale: 0.98 }],
  },
  morseSurface: {
    width: '100%',
    height: '100%',
  },
});
