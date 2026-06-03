import { Feather } from "@expo/vector-icons";
import { useListClasses } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const CLASS_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#f59e0b"];

export default function ClassesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: classes, isLoading, refetch } = useListClasses();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.flex}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.navTitle}>My Classes</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (classes ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="layers" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No classes yet</Text>
            <Text style={styles.emptyDesc}>Your classes will appear here once assigned</Text>
          </View>
        ) : (
          (classes ?? []).map((cls, i) => {
            const accent = CLASS_COLORS[i % CLASS_COLORS.length] ?? colors.primary;
            return (
              <View key={cls.id} style={styles.card}>
                <View style={[styles.cardAccent, { backgroundColor: accent }]} />
                <View style={styles.cardBody}>
                  <Text style={styles.className}>{cls.name}</Text>
                  <View style={styles.metaRow}>
                    {cls.subject_name ? (
                      <View style={styles.metaChip}>
                        <Feather name="book" size={12} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>{cls.subject_name}</Text>
                      </View>
                    ) : null}
                    {cls.grade_level ? (
                      <View style={styles.metaChip}>
                        <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
                        <Text style={styles.metaText}>{cls.grade_level}</Text>
                      </View>
                    ) : null}
                  </View>
                  {cls.room ? (
                    <View style={styles.roomRow}>
                      <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                      <Text style={styles.roomText}>{cls.room}</Text>
                    </View>
                  ) : null}
                  <View style={styles.statsRow}>
                    <View style={[styles.statBadge, { backgroundColor: accent + "15" }]}>
                      <Feather name="users" size={13} color={accent} />
                      <Text style={[styles.statText, { color: accent }]}>
                        {cls.student_count ?? 0} students
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// @ts-ignore
const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    navBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8),
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    navTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    container: { padding: 16, paddingBottom: insets.bottom + 32 },
    centered: { alignItems: "center", paddingTop: 60 },
    emptyState: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" },
    card: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: "hidden" },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, padding: 14 },
    className: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    metaText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    roomRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
    roomText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    statsRow: { flexDirection: "row", gap: 8 },
    statBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  });
