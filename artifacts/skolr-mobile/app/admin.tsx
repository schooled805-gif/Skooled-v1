import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useListProfiles,
  useListStudents,
  useListClasses,
  useListEvents,
  useListApprovals,
  useListReports,
} from "@workspace/api-client-react";
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

const SECTIONS = [
  { label: "Users", icon: "users", color: "#3b82f6", desc: "Manage all school users" },
  { label: "Students", icon: "book-open", color: "#22c55e", desc: "View and manage student records" },
  { label: "Teachers", icon: "edit", color: "#f97316", desc: "Manage teacher profiles" },
  { label: "Classes", icon: "layers", color: "#8b5cf6", desc: "View and manage classes" },
  { label: "Timetable", icon: "calendar", color: "#06b6d4", desc: "School timetable overview" },
  { label: "Events", icon: "star", color: "#f59e0b", desc: "Calendar events and activities" },
  { label: "Approvals", icon: "check-circle", color: "#22c55e", desc: "Review pending approvals" },
  { label: "Reports", icon: "file-text", color: "#ef4444", desc: "View student reports" },
  { label: "Announcements", icon: "bell", color: "#8b5cf6", desc: "Manage school announcements" },
];

function StatCard({
  label,
  value,
  icon,
  color,
  colors,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconBox, { backgroundColor: color + "18" }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "flex-start", gap: 6 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", lineHeight: 14 },
});

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: summary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: profiles, refetch: refetchProfiles } = useListProfiles();
  const { data: students, refetch: refetchStudents } = useListStudents();
  const { data: classes, refetch: refetchClasses } = useListClasses();
  const { data: events, refetch: refetchEvents } = useListEvents();
  const { data: approvals, refetch: refetchApprovals } = useListApprovals({});
  const { data: reports, refetch: refetchReports } = useListReports();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSummary(),
      refetchProfiles(),
      refetchStudents(),
      refetchClasses(),
      refetchEvents(),
      refetchApprovals(),
      refetchReports(),
    ]);
    setRefreshing(false);
  };

  const pendingApprovals = (approvals ?? []).filter((a) => a.status === "pending").length;
  const teacherCount = (profiles ?? []).filter((p) => p.role === "teacher").length;

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.flex}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.navTitle}>Admin Panel</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <StatCard label="Students" value={students?.length ?? summary?.total_students ?? 0} icon="users" color="#3b82f6" colors={colors} />
          <StatCard label="Teachers" value={(teacherCount || summary?.total_teachers) ?? 0} icon="edit" color="#22c55e" colors={colors} />
          <StatCard label="Classes" value={classes?.length ?? summary?.total_classes ?? 0} icon="layers" color="#8b5cf6" colors={colors} />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Events" value={events?.length ?? 0} icon="star" color="#f59e0b" colors={colors} />
          <StatCard label="Pending" value={pendingApprovals} icon="alert-circle" color="#ef4444" colors={colors} />
          <StatCard label="Reports" value={reports?.length ?? 0} icon="file-text" color="#06b6d4" colors={colors} />
        </View>

        <Text style={styles.sectionLabel}>Management</Text>
        {SECTIONS.map(({ label, icon, color, desc }) => (
          <View key={label} style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: color + "18" }]}>
              <Feather name={icon as any} size={18} color={color} />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{label}</Text>
              <Text style={styles.menuDesc}>{desc}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        ))}

        {pendingApprovals > 0 && (
          <View style={[styles.alertCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning + "40" }]}>
            <Feather name="alert-circle" size={16} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]}>
              {pendingApprovals} approval{pendingApprovals !== 1 ? "s" : ""} need{pendingApprovals === 1 ? "s" : ""} your attention
            </Text>
          </View>
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
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 8, paddingHorizontal: 4 },
    menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, gap: 12 },
    menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    menuContent: { flex: 1 },
    menuLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    menuDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    alertCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 8 },
    alertText: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  });
