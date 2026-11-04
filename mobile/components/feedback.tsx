import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { styles } from "./styles";
import type { MobileAlert, Screen } from "./types";

export function SkeletonBlock({
  pulse,
  darkMode,
  width,
  height,
  radius = 10,
  style,
}: {
  pulse: Animated.Value;
  darkMode: boolean;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  return <Animated.View style={[styles.skeletonBlock, darkMode && styles.darkSkeletonBlock, { width, height, borderRadius: radius, opacity: pulse }, style]} />;
}

export function SkeletonScreen({ variant, darkMode }: { variant: Screen | "boot"; darkMode: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0.42));
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.42, duration: 750, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const block = (width: number | `${number}%`, height: number, radius = 10, style?: object) => (
    <SkeletonBlock key={`${width}-${height}-${radius}-${String(style)}`} pulse={pulse} darkMode={darkMode} width={width} height={height} radius={radius} style={style} />
  );
  const row = (index: number) => (
    <View key={index} style={styles.skeletonRow}>
      {block(42, 42, 14)}
      <View style={styles.skeletonRowCopy}>{block("58%", 13)}{block("38%", 10)}</View>
      <View style={styles.skeletonRowAmount}>{block(54, 13)}{block(34, 9)}</View>
    </View>
  );

  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={[styles.skeletonPage, darkMode && styles.darkScroll]}>
      {variant === "boot" ? (
        <View style={styles.skeletonBoot}>
          {block(62, 62, 22)}
          {block(210, 22, 8)}
          {block(164, 13, 6)}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {variant === "dashboard" ? (
            <>
              <View style={styles.skeletonHeader}>{block(132, 17)}{block(72, 30, 12)}</View>
              <View style={styles.skeletonHero}>
                {block(104, 10, 5)}{block(148, 29, 8)}{block(116, 10, 5)}
                <View style={styles.skeletonHeroCircle}>{block(38, 38, 19)}</View>
              </View>
              <View style={styles.skeletonStats}>{[1, 2, 3].map((item) => <View key={item} style={[styles.skeletonStat, darkMode && styles.darkSkeletonSurface]}>{block("55%", 10)}{block("74%", 17)}</View>)}</View>
              {block(150, 16, 6)}
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("100%", 112, 14)}{block("74%", 12)}{block("42%", 10)}</View>
              {block(112, 16, 6)}
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3].map(row)}</View>
            </>
          ) : variant === "expenses" ? (
            <>
              <View style={styles.skeletonHeader}>{block(158, 22)}{block(88, 34, 12)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("42%", 10)}{block("68%", 22)}{block("100%", 14, 8)}</View>
              <View style={styles.skeletonChips}>{[72, 82, 88, 76].map((width) => block(width, 31, 16))}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3, 4, 5].map(row)}</View>
            </>
          ) : variant === "goals" ? (
            <>
              <View style={styles.skeletonHeader}>{block(142, 22)}{block(42, 42, 14)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block(88, 10)}{block("52%", 24)}{block("100%", 11)}</View>
              {[1, 2, 3].map((item) => <View key={item} style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("68%", 16)}{block("88%", 11)}{block("100%", 8, 6)}</View>)}
            </>
          ) : (
            <>
              <View style={styles.skeletonHeader}>{block("56%", 22)}{block(42, 42, 14)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("36%", 10)}{block(92, 24)}{block("64%", 10)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3, 4, 5].map(row)}</View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

export function AlertCenter({ alerts, onDismiss, onSnooze, onNavigate, onClose }: { alerts: MobileAlert[]; onDismiss: (id: string) => void; onSnooze: (id: string) => void; onNavigate: (screen: Screen) => void; onClose: () => void }) {
  return <View style={styles.modalBackdrop}><View style={styles.alertSheet}><View style={styles.formHeader}><View><Text style={styles.formTitle}>Alerts</Text><Text style={styles.muted}>{alerts.length ? "Action needed in your finances" : "You're all caught up"}</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>{alerts.length ? <ScrollView>{alerts.map((alert) => <View key={alert.id} style={styles.alertRow}><View style={[styles.alertDot, alert.severity === "high" ? styles.alertHigh : alert.severity === "medium" ? styles.alertMedium : styles.alertInfo]} /><Pressable style={styles.alertCopy} onPress={() => { void Haptics.selectionAsync(); onNavigate(alert.screen); }}><Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.muted}>{alert.detail}</Text></Pressable><Pressable onPress={() => { void Haptics.selectionAsync(); onSnooze(alert.id); }}><Text style={styles.snoozeText}>Later</Text></Pressable><Pressable onPress={() => { void Haptics.selectionAsync(); onDismiss(alert.id); }}><Text style={styles.dismissText}>Dismiss</Text></Pressable></View>)}</ScrollView> : <View style={styles.emptyAlert}><Text style={styles.emptyAlertIcon}>✓</Text><Text style={styles.sectionTitle}>No new alerts</Text><Text style={styles.muted}>We'll surface upcoming bills, budget risks, and payment reminders here.</Text></View>}</View></View>;
}
