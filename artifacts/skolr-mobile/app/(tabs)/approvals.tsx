import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useListApprovals, useRespondToApproval } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#f59e0b", bg: "#fef3c718" },
  approved: { label: "Approved", color: "#10b981", bg: "#d1fae518" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "#fee2e218" },
} as const;

export default function ApprovalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const role = profile?.role ?? "parent";
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: approvals, isLoading, refetch } = useListApprovals(
    role === "parent" ? { parent_id: user?.id } : {}
  );

  const { mutateAsync: respond } = useRespondToApproval();

  const filtered = (approvals ?? []).filter((a: any) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const handleRespond = async (id: string, decision: "approved" | "rejected") => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await respond({
        id,
        data: { status: decision },
      } as any);
      await qc.invalidateQueries({ queryKey: ["/api/approvals"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to respond. Please try again.");
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      margin: 16,
      marginBottom: 0,
      padding: 16,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1, marginRight: 8 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    meta: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 4 },
    desc: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, marginBottom: 12 },
    actions: { flexDirection: "row", gap: 10 },
    actionBtn: {
      flex: 1,
      height: 38,
      borderRadius: colors.radius,
      alignItems: "center",
      justifyContent: "center",
    },
    actionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 10 },
  });

  const FILTERS: Array<"all" | "pending" | "approved" | "rejected"> = ["pending", "approved", "rejected", "all"];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Approvals</Text>
      </View>

      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const isActive = filter === f;
          return (
            <Pressable
              key={f}
              style={[
                s.filterBtn,
                {
                  backgroundColor: isActive ? colors.primary : colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  s.filterText,
                  { color: isActive ? "#fff" : colors.foreground },
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          scrollEnabled={!!filtered.length}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="check-circle" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                {filter === "pending" ? "No pending approvals" : "Nothing here"}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => {
            const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
            const isPending = item.status === "pending";
            return (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>{item.title ?? item.type ?? "Request"}</Text>
                  <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                {item.student_name && (
                  <Text style={s.meta}>Student: {item.student_name}</Text>
                )}
                {item.description && (
                  <Text style={s.desc} numberOfLines={3}>{item.description}</Text>
                )}
                {isPending && (role === "parent" || role === "teacher" || role === "admin") && (
                  <View style={s.actions}>
                    <Pressable
                      style={({ pressed }) => [
                        s.actionBtn,
                        { backgroundColor: colors.destructive + "18", opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => handleRespond(item.id, "rejected")}
                    >
                      <Text style={[s.actionText, { color: colors.destructive }]}>Decline</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        s.actionBtn,
                        { backgroundColor: colors.teacherAccent + "18", opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => handleRespond(item.id, "approved")}
                    >
                      <Text style={[s.actionText, { color: colors.teacherAccent }]}>Approve</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
          onRefresh={refetch}
          refreshing={false}
        />
      )}
    </View>
  );
}
