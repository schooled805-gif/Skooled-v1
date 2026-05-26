import { Feather } from "@expo/vector-icons";
import { useListReports } from "@workspace/api-client-react";
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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function gradeColor(grade: string | undefined | null, colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  if (!grade) return colors.mutedForeground;
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return colors.success;
  if (g.startsWith("B")) return "#22d3ee";
  if (g.startsWith("C")) return colors.warning;
  if (g.startsWith("D") || g.startsWith("F")) return colors.destructive;
  return colors.primary;
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { data: reports, isLoading, refetch } = useListReports();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const visible = (reports ?? []).filter((r) =>
    role === "student" ? r.visible_to_student : true
  );

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.flex}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.navTitle}>Reports</Text>
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
        ) : visible.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyDesc}>Reports from your teachers will appear here</Text>
          </View>
        ) : (
          visible.map((report) => (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.reportTitle}>{report.title ?? "Report"}</Text>
                  {report.grade ? (
                    <View style={[styles.gradeBadge, { backgroundColor: gradeColor(report.grade, colors) + "20" }]}>
                      <Text style={[styles.gradeText, { color: gradeColor(report.grade, colors) }]}>{report.grade}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.reportDate}>
                  {report.created_at ? new Date(report.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : ""}
                </Text>
              </View>

              {report.subject ? (
                <View style={styles.metaRow}>
                  <Feather name="book" size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{report.subject}</Text>
                </View>
              ) : null}

              {report.teacher_name ? (
                <View style={styles.metaRow}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{report.teacher_name}</Text>
                </View>
              ) : null}

              {report.comments ? (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsLabel}>Comments</Text>
                  <Text style={styles.commentsText}>{report.comments}</Text>
                </View>
              ) : null}

              {report.score != null ? (
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>{report.score}%</Text>
                </View>
              ) : null}
            </View>
          ))
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
    emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" },
    card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
    cardHeader: { marginBottom: 10 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    reportTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
    gradeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
    reportDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    metaText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    commentsSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
    commentsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    commentsText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 },
    scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
    scoreLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    scoreValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  });
