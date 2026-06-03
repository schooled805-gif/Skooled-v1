import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import {
  useGetDashboardSummary,
  useListAnnouncements,
  useListApprovals,
  useListParentStudentLinks,
  useListTimetableEntries,
} from "@workspace/api-client-react";

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{title}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  const colors = useColors();
  return (
    <View style={{
      flex: 1, backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: "center",
    }}>
      <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const role = profile?.role ?? "student";
  const today = DAY_NAMES[new Date().getDay()];
  const [selectedAnn, setSelectedAnn] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const accent = (colors as any)[`${role}Accent`] ?? colors.primary;

  const { data: timetable, isLoading: ttLoading, refetch: refetchTT } = useListTimetableEntries();
  const { data: announcements, isLoading: annLoading, refetch: refetchAnn } = useListAnnouncements({
    audience_type: role === "teacher" || role === "admin" ? "teacher" : role,
  });
  const { data: approvals, isLoading: appLoading, refetch: refetchApprovals } = useListApprovals({
    parent_id: role === "parent" ? user?.id : undefined,
  });
  const { data: links, isLoading: linksLoading, refetch: refetchLinks } = useListParentStudentLinks({
    parent_user_id: role === "parent" ? user?.id : undefined,
  });
  const { data: dashboard, refetch: refetchDash } = useGetDashboardSummary();

  const todayClasses = (timetable ?? []).filter(
    (e: any) => e.day_of_week?.toLowerCase() === today.toLowerCase()
  );
  const nextClass = todayClasses.find((e: any) => {
    const [h, m] = (e.start_time ?? "").split(":").map(Number);
    const now = new Date();
    return h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
  });
  const pendingApprovals = (approvals ?? []).filter((a: any) => a.status === "pending");
  const recentAnn = (announcements ?? []).slice(0, 3);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTT(), refetchAnn(), refetchApprovals(), refetchLinks(), refetchDash()]);
    setRefreshing(false);
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

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
    greeting: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtext: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: accent + "18",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      marginTop: 8,
    },
    badgeText: { fontSize: 12, fontFamily: "Inter_500Medium", color: accent },
    content: { padding: 20, paddingBottom: 120 },
    section: { marginBottom: 24 },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
    annCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
    },
    annTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    annBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 },
    annPriority: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 6,
    },
    classCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    classDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.studentAccent },
    classSubject: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    classTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    approvalCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    approvalTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    approvalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    emptyState: { alignItems: "center", paddingVertical: 20 },
    emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 8 },
  });

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.greeting}>Hey{firstName ? `, ${firstName}` : ""}!</Text>
        <Text style={s.subtext}>
          {nextClass
            ? `Next: ${(nextClass as any).subject_name ?? "class"} at ${(nextClass as any).start_time}`
            : todayClasses.length > 0
            ? `${todayClasses.length} class${todayClasses.length !== 1 ? "es" : ""} today`
            : "No classes today — have a great day!"}
        </Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{roleLabel} Portal</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={s.statsRow}>
          {role === "student" && (
            <>
              <StatCard value={ttLoading ? "–" : todayClasses.length} label="Today's classes" color={colors.studentAccent} />
              <StatCard value={annLoading ? "–" : recentAnn.length} label="Announcements" color={colors.parentAccent} />
            </>
          )}
          {role === "parent" && (
            <>
              <StatCard value={linksLoading ? "–" : (links as any[])?.length ?? 0} label="Children" color={colors.parentAccent} />
              <StatCard value={appLoading ? "–" : pendingApprovals.length} label="Pending approvals" color={colors.destructive} />
            </>
          )}
          {role === "teacher" && (
            <>
              <StatCard value={ttLoading ? "–" : todayClasses.length} label="Classes today" color={colors.teacherAccent} />
              <StatCard value={appLoading ? "–" : pendingApprovals.length} label="Pending approvals" color={colors.destructive} />
            </>
          )}
          {role === "admin" && (
            <>
              <StatCard value={(dashboard as any)?.total_students ?? "–"} label="Students" color={colors.primary} />
              <StatCard value={(dashboard as any)?.total_teachers ?? "–"} label="Teachers" color={colors.teacherAccent} />
            </>
          )}
          <StatCard value={annLoading ? "–" : (announcements ?? []).length} label="Announcements" color={colors.primary} />
        </View>

        {(role === "student" || role === "teacher") && (
          <View style={s.section}>
            <SectionHeader
              title={`Today — ${today}`}
              action="Full schedule"
              onAction={() => router.push("/(tabs)/schedule")}
            />
            {ttLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : todayClasses.length === 0 ? (
              <View style={s.emptyState}>
                <Feather name="coffee" size={28} color={colors.mutedForeground} />
                <Text style={s.emptyText}>No classes scheduled today</Text>
              </View>
            ) : (
              todayClasses.slice(0, 4).map((entry: any, i: number) => (
                <View key={entry.id ?? i} style={s.classCard}>
                  <View style={[s.classDot, { backgroundColor: accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.classSubject}>{entry.subject_name ?? entry.class_name ?? "Class"}</Text>
                    <Text style={s.classTime}>
                      {entry.start_time} – {entry.end_time} · {entry.room_name ?? ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {(role === "parent" || role === "teacher" || role === "admin") && pendingApprovals.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Pending Approvals"
              action="See all"
              onAction={() => router.push("/(tabs)/approvals")}
            />
            {pendingApprovals.slice(0, 3).map((a: any) => (
              <View key={a.id} style={s.approvalCard}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.destructive + "18",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather name="clock" size={18} color={colors.destructive} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.approvalTitle}>{a.title ?? "Approval request"}</Text>
                  <Text style={s.approvalSub}>{a.type ?? ""}{a.student_name ? ` · ${a.student_name}` : ""}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <SectionHeader title="Announcements" />
          {annLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : recentAnn.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="megaphone-outline" size={28} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No announcements</Text>
            </View>
          ) : (
            recentAnn.map((ann: any) => (
              <Pressable
                key={ann.id}
                style={({ pressed }) => [s.annCard, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setSelectedAnn(ann)}
              >
                {ann.priority && ann.priority !== "normal" && (
                  <View
                    style={[
                      s.annPriority,
                      {
                        backgroundColor:
                          ann.priority === "high"
                            ? colors.destructive + "18"
                            : "#f59e0b18",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Inter_500Medium",
                        color: ann.priority === "high" ? colors.destructive : "#f59e0b",
                      }}
                    >
                      {ann.priority.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={s.annTitle}>{ann.title}</Text>
                <Text style={s.annBody} numberOfLines={2}>{ann.body}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedAnn} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedAnn(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
          }}>
            <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              Announcement
            </Text>
            <Pressable onPress={() => setSelectedAnn(null)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 12 }}>
              {selectedAnn?.title}
            </Text>
            <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 24 }}>
              {selectedAnn?.body}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
