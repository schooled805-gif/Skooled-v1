import { Feather } from "@expo/vector-icons";
import { useListReports } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function gradeColor(
  grade: string | undefined | null,
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>
) {
  if (!grade) return colors.mutedForeground;
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return colors.success;
  if (g.startsWith("B")) return "#22d3ee";
  if (g.startsWith("C")) return colors.warning;
  if (g.startsWith("D") || g.startsWith("F")) return colors.destructive;
  return colors.primary;
}

export default function ReportsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role, loading: authLoading } = useAuth();
  const { data: reports, isLoading, refetch } = useListReports();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== "student" && role !== "parent") {
      router.replace("/");
    }
  }, [role, authLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (authLoading || (role !== "student" && role !== "parent")) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const visible = (reports ?? []).filter((r) =>
    role === "student" ? r.visible_to_student : true
  );

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        {!isLoading && visible.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{visible.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15" }]}>
              <Feather name="file-text" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyDesc}>
              {role === "student"
                ? "Your school reports will appear here once your teacher shares them with you."
                : "Your children's school reports will appear here once teachers share them."}
            </Text>
          </View>
        ) : (
          visible.map((report) => (
            <View key={report.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.reportTitle} numberOfLines={2}>
                    {report.title ?? "Report"}
                  </Text>
                  {report.grade ? (
                    <View
                      style={[
                        styles.gradeBadge,
                        { backgroundColor: gradeColor(report.grade, colors) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeText,
                          { color: gradeColor(report.grade, colors) },
                        ]}
                      >
                        {report.grade}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.metaChips}>
                  {report.term ? (
                    <View style={[styles.chip, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.chipText, { color: colors.primary }]}>
                        {report.term}
                      </Text>
                    </View>
                  ) : null}
                  {report.year ? (
                    <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.chipText, { color: colors.foreground }]}>
                        {report.year}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardBody}>
                {report.student_name && role === "parent" ? (
                  <View style={styles.metaRow}>
                    <Feather name="user" size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{report.student_name}</Text>
                  </View>
                ) : null}

                {report.subject ? (
                  <View style={styles.metaRow}>
                    <Feather name="book" size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{report.subject}</Text>
                  </View>
                ) : null}

                {report.teacher_name ? (
                  <View style={styles.metaRow}>
                    <Feather name="user-check" size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{report.teacher_name}</Text>
                  </View>
                ) : null}

                <View style={styles.metaRow}>
                  <Feather name="calendar" size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </Text>
                </View>
              </View>

              {report.comments ? (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsLabel}>Teacher Comments</Text>
                  <Text style={styles.commentsText}>{report.comments}</Text>
                </View>
              ) : null}

              {report.score != null ? (
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>
                    {report.score}%
                  </Text>
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
const makeStyles = (
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<
    typeof import("react-native-safe-area-context").useSafeAreaInsets
  >
) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
      paddingBottom: 16,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    countText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    container: {
      padding: 16,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) + 80,
    },
    centered: { alignItems: "center", paddingTop: 60 },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
      gap: 12,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    emptyDesc: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    cardHeader: {
      padding: 16,
      paddingBottom: 12,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 8,
    },
    reportTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
      lineHeight: 22,
    },
    gradeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      flexShrink: 0,
    },
    gradeText: { fontSize: 14, fontFamily: "Inter_700Bold" },
    metaChips: { flexDirection: "row", gap: 6 },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    chipText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    cardBody: {
      padding: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 6,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    metaText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    commentsSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    commentsLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    commentsText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 21,
    },
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    scoreLabel: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    scoreValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  });
