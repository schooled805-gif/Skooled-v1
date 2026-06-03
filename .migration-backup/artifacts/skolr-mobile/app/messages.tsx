import { Feather } from "@expo/vector-icons";
import { useListConversations } from "@workspace/api-client-react";
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

function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: conversations, isLoading, refetch } = useListConversations();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const sorted = (conversations ?? []).sort(
    (a, b) => new Date(b.last_message_at ?? b.created_at ?? 0).getTime() - new Date(a.last_message_at ?? a.created_at ?? 0).getTime()
  );

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.flex}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.navTitle}>Messages</Text>
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
        ) : sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyDesc}>Messages from teachers and parents will appear here</Text>
          </View>
        ) : (
          sorted.map((conv) => {
            const initials = (conv.participant_name ?? conv.subject ?? "?")
              .split(" ")
              .map((n: string) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <View key={conv.id} style={styles.convRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.convContent}>
                  <View style={styles.convHeader}>
                    <Text style={styles.convName} numberOfLines={1}>
                      {conv.participant_name ?? conv.subject ?? "Conversation"}
                    </Text>
                    <Text style={styles.convTime}>
                      {timeAgo(conv.last_message_at ?? conv.created_at)}
                    </Text>
                  </View>
                  {conv.last_message ? (
                    <Text style={styles.convPreview} numberOfLines={1}>{conv.last_message}</Text>
                  ) : null}
                  {conv.subject && conv.participant_name ? (
                    <Text style={styles.convSubject} numberOfLines={1}>{conv.subject}</Text>
                  ) : null}
                </View>
                {(conv.unread_count ?? 0) > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unreadText}>{conv.unread_count}</Text>
                  </View>
                )}
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
    container: { paddingBottom: insets.bottom + 32 },
    centered: { alignItems: "center", paddingTop: 60 },
    emptyState: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" },
    convRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    convContent: { flex: 1, minWidth: 0 },
    convHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
    convName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    convTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginLeft: 8 },
    convPreview: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    convSubject: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2, fontStyle: "italic" },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  });
