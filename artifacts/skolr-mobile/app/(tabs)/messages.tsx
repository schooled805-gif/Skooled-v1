import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useListConversations } from "@workspace/api-client-react";

function AvatarInitials({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <View
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: color + "20",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color }}>{initials}</Text>
    </View>
  );
}

const AVATAR_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f97316", "#ef4444", "#06b6d4"];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: conversations, isLoading, refetch } = useListConversations();

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    lastMsg: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    time: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.primary,
      position: "absolute",
      top: 0,
      right: 0,
    },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 10,
    },
  });

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations as any[]}
          keyExtractor={(item: any) => item.other_user_id ?? item.id}
          scrollEnabled={!!(conversations as any[])?.length}
          contentContainerStyle={
            !(conversations as any[])?.length
              ? { flex: 1 }
              : { paddingBottom: 100 }
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="message-square" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No conversations yet</Text>
            </View>
          }
          renderItem={({ item, index }: { item: any; index: number }) => {
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const name = item.other_user_name ?? item.other_user_id ?? "Unknown";
            const hasUnread = item.unread_count > 0;
            return (
              <Pressable
                style={({ pressed }) => [s.item, { backgroundColor: pressed ? colors.accent : "transparent" }]}
                onPress={() =>
                  router.push({
                    pathname: "/conversation/[id]",
                    params: { id: item.other_user_id, name },
                  })
                }
              >
                <View style={{ position: "relative" }}>
                  <AvatarInitials name={name} color={avatarColor} />
                  {hasUnread && <View style={s.unreadDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[s.name, hasUnread && { fontFamily: "Inter_700Bold" }]}>
                      {name}
                    </Text>
                    <Text style={s.time}>{formatTime(item.last_message_at)}</Text>
                  </View>
                  <Text style={s.lastMsg} numberOfLines={1}>
                    {item.last_message ?? "No messages yet"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          onRefresh={refetch}
          refreshing={false}
        />
      )}
    </View>
  );
}
