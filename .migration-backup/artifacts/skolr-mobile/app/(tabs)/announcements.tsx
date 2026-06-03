import { Feather } from "@expo/vector-icons";
import { useListAnnouncements } from "@workspace/api-client-react";
import React, { useState } from "react";
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

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m ago`;
}

export default function AnnouncementsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();

  const audienceType = role === "teacher" || role === "admin" ? undefined : role ?? "student";
  const { data: announcements, isLoading, refetch } = useListAnnouncements(
    audienceType ? { audience_type: audienceType } : undefined
  );
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const sorted = (announcements ?? []).sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pa = pOrder[a.priority ?? "low"] ?? 2;
    const pb = pOrder[b.priority ?? "low"] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const styles = makeStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Announcements</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="bell" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No announcements</Text>
          <Text style={styles.emptyDesc}>Check back later for updates</Text>
        </View>
      ) : (
        sorted.map((ann) => (
          <View key={ann.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.metaRow}>
                {ann.priority && ann.priority !== "low" ? (
                  <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[ann.priority] + "20" }]}>
                    <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[ann.priority] }]} />
                    <Text style={[styles.priorityText, { color: PRIORITY_COLORS[ann.priority] }]}>
                      {ann.priority}
                    </Text>
                  </View>
                ) : null}
                {ann.audience_type ? (
                  <View style={styles.audienceBadge}>
                    <Text style={styles.audienceText}>{ann.audience_type}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.timeAgo}>{timeAgo(ann.created_at)}</Text>
            </View>

            <Text style={styles.annTitle}>{ann.title}</Text>
            {ann.body ? <Text style={styles.annBody}>{ann.body}</Text> : null}

            {ann.author_name ? (
              <View style={styles.authorRow}>
                <Feather name="user" size={12} color={colors.mutedForeground} />
                <Text style={styles.authorText}>{ann.author_name}</Text>
              </View>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
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
    centered: {
      paddingTop: 60,
      alignItems: "center",
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
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    metaRow: {
      flexDirection: "row",
      gap: 6,
    },
    priorityBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    priorityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    priorityText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      textTransform: "capitalize",
    },
    audienceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.secondary,
    },
    audienceText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "capitalize",
    },
    timeAgo: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    annTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 6,
    },
    annBody: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 20,
      marginBottom: 10,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    authorText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
