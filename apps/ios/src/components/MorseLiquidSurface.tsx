import { Canvas, RoundedRect, Shader, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type LayoutSize = {
  width: number;
  height: number;
};

type MorseLiquidSurfaceProps = {
  speedMultiplier?: number;
  style?: StyleProp<ViewStyle>;
};

const SWIRL_SHADER_SOURCE = `
  uniform float iTime;
  uniform vec2 iResolution;

  const float PI = 3.14159265;

  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs((q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
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

    float r = 0.5 * abs(sin(uv.x + t));
    float g = 0.5 * abs(sin(uv.y + t + 2.0));
    float b = 0.6 * abs(sin(uv.x + uv.y));

    vec3 col = vec3(r, g, b);
    col = pow(col, vec3(2.0));
    col = clamp(col, 0.0, 1.0);

    float shine = max(0.0, dot(normalize(col), vec3(0.577)));
    col += pow(shine, 8.0) * 0.15;

    float maxChannel = max(col.r, max(col.g, col.b));
    float fade = smoothstep(0.15, 0.35, maxChannel);
    col *= fade;

    // Set hue to 192deg (0.533)
    vec3 hsv = rgb2hsv(col);
    hsv.x = 0.633;
    col = hsv2rgb(hsv);

    return half4(col, 1.0);
  }
`;

const SWIRL_RUNTIME_EFFECT = Skia.RuntimeEffect.Make(SWIRL_SHADER_SOURCE);

const useLayoutSize = () => {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (__DEV__) {
      console.info('[MorseLiquidSurface] layout', { width, height });
    }
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height });
    }
  };

  return { layout, onLayout };
};

/** Liquid shader layer for Morse UI surfaces or full-screen backgrounds. */
export function MorseLiquidSurface({
  speedMultiplier = 1,
  style,
}: MorseLiquidSurfaceProps) {
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
      console.info('[MorseLiquidSurface] waiting for layout');
      hasLoggedWaiting.current = true;
    }
  }, [layout.height, layout.width]);
  const radius = 0;
  const surfaceRect = useMemo(() => {
    if (layout.width === 0 || layout.height === 0) {
      return null;
    }
    return Skia.XYWHRect(0, 0, layout.width, layout.height);
  }, [layout.width, layout.height]);

  const surfaceRRect = surfaceRect
    ? Skia.RRectXY(surfaceRect, radius, radius)
    : null;
  const time = useSharedValue(0);

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
      (time.value +
        (frameInfo.timeSincePreviousFrame / 1000) * speedValue.value) %
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
    console.info('[MorseLiquidSurface] render-ready', {
      width: layout.width,
      height: layout.height,
      radius,
      runtimeEffect: Boolean(SWIRL_RUNTIME_EFFECT),
    });
  }, [layout.height, layout.width, radius]);

  if (!surfaceRect || !surfaceRRect || !SWIRL_RUNTIME_EFFECT) {
    return (
      <View
        style={[styles.surface, style]}
        onLayout={onLayout}
        pointerEvents="none"
      />
    );
  }

  return (
    <View
      style={[styles.surface, style]}
      onLayout={onLayout}
      pointerEvents="none"
    >
      <Canvas
        style={{ width: layout.width, height: layout.height }}
        pointerEvents="none"
      >
        <RoundedRect rect={surfaceRRect}>
          <Shader source={SWIRL_RUNTIME_EFFECT} uniforms={uniforms} />
        </RoundedRect>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: '100%',
    height: '100%',
  },
});
