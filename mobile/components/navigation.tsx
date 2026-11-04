import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { moduleLabels } from "./constants";
import { styles } from "./styles";
import type { Screen } from "./types";

export function TopBar({ screen, onSettings, onAlerts, alertCount, darkMode, user }: { screen: Screen; onSettings: () => void; onAlerts: () => void; alertCount: number; darkMode: boolean; user: { fullName: string } }) {
  const titles: Record<Screen, string> = { dashboard: "Good morning, Alex", expenses: "Expenses", accounts: "Accounts & cards", goals: "Savings goals", more: "More", secureVault: "Secure Vault", personalRecords: "Personal Records", ...moduleLabels };
  return <View style={styles.topBar}><View><Text style={styles.overline}>BUDGET TRACKER</Text><Text style={[styles.topTitle, darkMode && styles.darkText]}>{screen === "dashboard" ? `Good morning, ${user.fullName}` : titles[screen]}</Text></View><View style={styles.topActions}><Pressable onPress={onAlerts} style={[styles.bellButton, darkMode && styles.darkControl]}><Text style={[styles.bellText, darkMode && styles.darkText]}>♢</Text>{alertCount > 0 && <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>{alertCount > 9 ? "9+" : alertCount}</Text></View>}</Pressable><Pressable onPress={onSettings} style={styles.avatar}><Text style={styles.avatarText}>{darkMode ? "☼" : user.fullName.slice(0, 1).toUpperCase()}</Text></Pressable></View></View>;
}

export function AnimatedScreen({ screen, children }: { screen: Screen; children: React.ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateX] = useState(() => new Animated.Value(18));
  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, damping: 18, stiffness: 180, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, [screen, opacity, translateX]);
  return <Animated.View style={[styles.body, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

export function PressableScale({ children, onPress, style, accessibilityLabel }: { children: React.ReactNode; onPress: () => void; style?: object; accessibilityLabel?: string }) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, damping: 16, stiffness: 260 }).start();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => animate(0.94)} onPressOut={() => animate(1)}><Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View></Pressable>;
}

export function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) { return <View style={styles.bottomNav}>{[["dashboard", "⌂", "Home"], ["expenses", "◔", "Expenses"], ["accounts", "▣", "Accounts"], ["goals", "◎", "Goals"], ["more", "☷", "More"]].map(([key, icon, label]) => { const selected = screen === key || (key === "more" && (screen === "secureVault" || screen === "personalRecords")); return <PressableScale key={key} accessibilityLabel={`Open ${label}`} onPress={() => setScreen(key as Screen)} style={styles.navItem}><Animated.View style={[styles.navIndicator, selected && styles.navIndicatorActive]} /><Text style={[styles.navIcon, selected && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, selected && styles.navActive]}>{label}</Text></PressableScale>; })}</View>; }
