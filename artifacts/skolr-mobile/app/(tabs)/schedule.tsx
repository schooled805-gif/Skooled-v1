import { Feather } from "@expo/vector-icons";
import { useListTimetableEntries, useListApprovals } from "@workspace/api-client-react";
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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const TYPE_COLORS: Record<string, string> = {
  lesson: "#f97316",
  sport: "#3b82f6",
  exam: "#ef4444",
  event: "#8b5cf6",
  homework: "#64748b",
};

function TimetableView() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    const idx = d === 0 ? 0 : d === 6 ? 4 : d - 1;
    return DAYS[idx] ?? "Monday";
  });
  const { data: entries, isLoading, refetch } = useListTimetableEntries();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const dayEntries = (entries ?? [])
    .filter((e) => e.day_of_week?.toLowerCase() === selectedDay.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const styles = makeStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Timetable</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
        {DAYS.map((day) => (
          <Pressable
            key={day}
            style={[
              styles.dayChip,
              {
                backgroundColor: selectedDay === day ? colors.primary : colors.secondary,
              },
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <Text
              style={[
                styles.dayChipText,
                { color: selectedDay === day ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {day.slice(0, 3)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : dayEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="calendar" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No classes {selectedDay}</Text>
          <Text style={styles.emptyDesc}>Enjoy your free day</Text>
        </View>
      ) : (
        dayEntries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={[styles.entryAccent, { backgroundColor: TYPE_COLORS[entry.type ?? "lesson"] ?? colors.primary }]} />
            <View style={styles.entryContent}>
              <View style={styles.entryHeader}>
                <Text style={styles.subjectName}>{entry.subject_name ?? "Class"}</Text>
                <View style={[styles.typeBadge, { backgroundColor: (TYPE_COLORS[entry.type ?? "lesson"] ?? colors.primary) + "20" }]}>
                  <Text style={[styles.typeText, { color: TYPE_COLORS[entry.type ?? "lesson"] ?? colors.primary }]}>
                    {entry.type ?? "lesson"}
                  </Text>
                </View>
              </View>
              <View style={styles.entryMeta}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{entry.start_time} – {entry.end_time}</Text>
                {entry.room ? (
                  <>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} style={styles.metaIcon} />
                    <Text style={styles.metaText}>{entry.room}</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function ApprovalsView() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: approvals, isLoading, refetch } = useListApprovals({ parent_id: user?.id });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const resolved = (approvals ?? []).filter((a) => a.status !== "pending");

  const styles = makeStyles(colors, insets);

  const statusColor = (status: string) => {
    if (status === "approved") return colors.success;
    if (status === "rejected") return colors.destructive;
    return colors.warning;
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Approvals</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (approvals ?? []).length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No approvals</Text>
          <Text style={styles.emptyDesc}>Nothing needs your attention right now</Text>
        </View>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Pending ({pending.length})</Text>
              {pending.map((a) => (
                <View key={a.id} style={styles.approvalCard}>
                  <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
                  <View style={styles.approvalContent}>
                    <Text style={styles.approvalTitle}>{a.title}</Text>
                    {a.description ? <Text style={styles.approvalDesc}>{a.description}</Text> : null}
                    <Text style={styles.approvalMeta}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Resolved</Text>
              {resolved.map((a) => (
                <View key={a.id} style={[styles.approvalCard, styles.resolvedCard]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(a.status ?? "") }]} />
                  <View style={styles.approvalContent}>
                    <Text style={[styles.approvalTitle, styles.resolvedText]}>{a.title}</Text>
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusBadge, { color: statusColor(a.status ?? "") }]}>
                        {a.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

export default function ScheduleTab() {
  const { role } = useAuth();
  if (role === "parent" || role === "admin") {
    return <ApprovalsView />;
  }
  return <TimetableView />;
}

// @ts-ignore
const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
      padding: 16,
      paddingTop: Platform.OS === "web" ? 67 + 16 : 16,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) + 80,
    },
    pageTitle: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 16,
    },
    dayPicker: {
      marginBottom: 16,
    },
    dayChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
    },
    dayChipText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      gap: 12,
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
    },
    entryCard: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: "hidden",
    },
    entryAccent: {
      width: 4,
    },
    entryContent: {
      flex: 1,
      padding: 14,
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    subjectName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    typeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      textTransform: "capitalize",
    },
    entryMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    metaIcon: {
      marginLeft: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    approvalCard: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      alignItems: "flex-start",
      gap: 12,
    },
    resolvedCard: {
      opacity: 0.7,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
    },
    approvalContent: {
      flex: 1,
    },
    approvalTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 4,
    },
    resolvedText: {
      color: colors.mutedForeground,
    },
    approvalDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    approvalMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    statusBadge: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      textTransform: "capitalize",
    },
  });
