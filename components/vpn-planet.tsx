import { useEffect, useMemo } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

const SIZE = 258;
const C = "#21A9E8";

export function VpnPlanet({ onPress, connected, label }: { onPress: () => void; connected: boolean; label: string }) {
  const rotation = useMemo(() => new Animated.Value(0), []);
  const orbit = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    let reduceMotion = false;
    let alive = true;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { reduceMotion = value; });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotion = value; });
    const start = () => {
      if (!alive || reduceMotion) return;
      rotation.setValue(0); orbit.setValue(0);
      Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 32000, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([
        Animated.timing(orbit, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(orbit, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])).start();
    };
    start();
    const motionListener = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      reduceMotion = value;
      rotation.stopAnimation(); orbit.stopAnimation();
      if (!value) start();
    });
    return () => { alive = false; subscription.remove(); motionListener.remove(); rotation.stopAnimation(); orbit.stopAnimation(); };
  }, [orbit, rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const reverseSpin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const pulse = orbit.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] });
  const tint = connected ? "#17A67A" : C;

  return (
    <View style={styles.stage}>
      <Animated.View pointerEvents="none" style={[styles.orbit, { transform: [{ rotate: spin }, { scale: pulse }] }]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 258 258">
          <Circle cx="129" cy="129" r="116" fill="none" stroke={tint} strokeOpacity="0.20" strokeWidth="1" strokeDasharray="2 7" />
          <Path d="M58 35 A108 108 0 0 1 135 20 M202 53 A108 108 0 0 1 238 118 M194 221 A108 108 0 0 1 116 237 M20 146 A108 108 0 0 1 45 65" fill="none" stroke={tint} strokeOpacity="0.65" strokeWidth="1.5" />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.globe, { transform: [{ rotate: reverseSpin }] }]}>
        <Svg width={218} height={218} viewBox="0 0 218 218">
          <Circle cx="109" cy="109" r="77" fill="#EAF8FE" fillOpacity="0.5" stroke={tint} strokeOpacity="0.50" strokeWidth="1.3" />
          <Ellipse cx="109" cy="109" rx="77" ry="30" fill="none" stroke={tint} strokeOpacity="0.42" strokeWidth="1" />
          <Ellipse cx="109" cy="109" rx="77" ry="53" fill="none" stroke={tint} strokeOpacity="0.32" strokeWidth="1" />
          <Ellipse cx="109" cy="109" rx="31" ry="77" fill="none" stroke={tint} strokeOpacity="0.42" strokeWidth="1" />
          <Ellipse cx="109" cy="109" rx="54" ry="77" fill="none" stroke={tint} strokeOpacity="0.30" strokeWidth="1" />
          <Path d="M33 109h152M41 80h136M41 138h136M109 32v154" stroke={tint} strokeOpacity="0.28" strokeWidth="1" />
          <Path d="M55 61 164 156M163 62 55 157M53 111 154 47M65 172 173 103" stroke={tint} strokeOpacity="0.38" strokeWidth="1" />
          <Circle cx="62" cy="80" r="2.5" fill={tint} /><Circle cx="151" cy="61" r="2" fill={tint} /><Circle cx="168" cy="125" r="2.5" fill={tint} /><Circle cx="75" cy="159" r="2" fill={tint} />
          <Line x1="27" y1="109" x2="17" y2="109" stroke={tint} strokeWidth="1.5" /><Line x1="191" y1="109" x2="201" y2="109" stroke={tint} strokeWidth="1.5" />
        </Svg>
      </Animated.View>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.powerHit, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label}>
        <View style={[styles.powerHalo, { backgroundColor: connected ? "#DDF8EE" : "#DDF3FC" }]}>
          <View style={[styles.power, { backgroundColor: connected ? "#159A70" : "#087EB5" }]}>
            <Svg width={35} height={35} viewBox="0 0 24 24"><Path d="M12 2v10M6.2 5.8a8 8 0 1 0 11.6 0" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" /></Svg>
          </View>
        </View>
      </Pressable>
      <View pointerEvents="none" style={styles.sparkleA} /><View pointerEvents="none" style={styles.sparkleB} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: SIZE, height: SIZE, maxWidth: "100%", alignItems: "center", justifyContent: "center", marginTop: 5, marginBottom: 0 },
  orbit: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  globe: { width: 218, height: 218, alignItems: "center", justifyContent: "center" },
  powerHit: { position: "absolute", width: 82, height: 82, alignItems: "center", justifyContent: "center", borderRadius: 41 },
  powerHalo: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", shadowColor: C, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 3 }, elevation: 7 },
  power: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  sparkleA: { position: "absolute", right: 34, top: 83, width: 8, height: 8, borderRadius: 4, backgroundColor: C, opacity: 0.55 },
  sparkleB: { position: "absolute", left: 31, bottom: 64, width: 5, height: 5, borderRadius: 3, backgroundColor: C, opacity: 0.35 },
});
