import { Feather } from "@expo/vector-icons";
import {
  useListAnnouncements,
  useListApprovals,
  useListReports,
  useListTimetableEntries,
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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    <View style={[statCardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statCardStyles.iconBox, { backgroundColor: color + "18" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[statCardStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statCardStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
});

function StudentDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const today = DAY_NAMES[new Date().getDay()] ?? "Monday";
  const [refreshing, setRefreshing] = useState(false);

  const { data: timetable, isLoading: loadingT, refetch: refetchT } = useListTimetableEntries();
  const { data: announcements, isLoading: loadingA, refetch: refetchA } = useListAnnouncements({ audience_type: "student" });
  const { data: reports, isLoading: loadingR, refetch: refetchR } = useListReports();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchT(), refetchA(), refetchR()]);
    setRefreshing(false);
  };

  const todayEntries = (timetable ?? [])
    .filter((e) => e.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nextClass = todayEntries.find((e) => {
    const [h, m] = e.start_time.split(":").map(Number);
    const now = new Date();
    return (h ?? 0) > now.getHours() || ((h ?? 0) === now.getHours() && (m ?? 0) > now.getMinutes());
  });

  const visibleReports = (reports ?? []).filter((r) => r.visible_to_student);
  const isLoading = loadingT && loadingA && loadingR;

  const styles = makeDashStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hey{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
          </Text>
          <Text style={styles.subGreeting}>
            {nextClass
              ? `Next: ${nextClass.subject_name ?? "class"} at ${nextClass.start_time}`
              : todayEntries.length > 0
              ? `${todayEntries.length} class${todayEntries.length !== 1 ? "es" : ""} today`
              : "No classes today"}
          </Text>
        </View>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "S"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label="Today's Classes"
              value={todayEntries.length}
              icon="clock"
              color={colors.orange}
              colors={colors}
            />
            <StatCard
              label="Announcements"
              value={announcements?.length ?? 0}
              icon="bell"
              color={colors.purple}
              colors={colors}
            />
            <StatCard
              label="My Reports"
              value={visibleReports.length}
              icon="file-text"
              color={colors.primary}
              colors={colors}
            />
          </View>

          {todayEntries.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {todayEntries.slice(0, 4).map((entry) => (
                <View key={entry.id} style={styles.classRow}>
                  <View style={styles.classTime}>
                    <Text style={styles.classTimeText}>{entry.start_time}</Text>
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{entry.subject_name ?? "Class"}</Text>
                    {entry.room ? <Text style={styles.classRoom}>{entry.room}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {(announcements?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Updates</Text>
              {(announcements ?? []).slice(0, 3).map((ann) => (
                <View key={ann.id} style={styles.annRow}>
                  <View style={[styles.annDot, { backgroundColor: colors.purple }]} />
                  <Text style={styles.annTitle} numberOfLines={2}>{ann.title}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            {[
              { label: "My Reports", icon: "file-text", color: colors.primary, route: "/reports" },
            ].map(({ label, icon, color, route }) => (
              <Pressable key={label} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.7 : 1, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
                <Feather name={icon as any} size={18} color={color} />
                <Text style={[styles.quickBtnText, { color: colors.foreground }]}>{label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ParentDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: approvals, isLoading: loadingApp, refetch: refetchApp } = useListApprovals({ parent_id: user?.id });
  const { data: announcements, isLoading: loadingAnn, refetch: refetchAnn } = useListAnnouncements({ audience_type: "parent" });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchApp(), refetchAnn()]);
    setRefreshing(false);
  };

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const isLoading = loadingApp && loadingAnn;

  const styles = makeDashStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.subGreeting}>Here's what's happening today</Text>
        </View>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "P"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label="Pending Approvals"
              value={pending.length}
              icon="alert-circle"
              color={colors.warning}
              colors={colors}
            />
            <StatCard
              label="Announcements"
              value={announcements?.length ?? 0}
              icon="bell"
              color={colors.purple}
              colors={colors}
            />
          </View>

          {pending.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Needs Attention</Text>
              {pending.slice(0, 3).map((a) => (
                <View key={a.id} style={[styles.alertCard, { borderColor: colors.warning + "40", backgroundColor: colors.warning + "08" }]}>
                  <Feather name="alert-circle" size={16} color={colors.warning} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{a.title}</Text>
                    {a.description ? <Text style={styles.alertDesc} numberOfLines={1}>{a.description}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {(announcements?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Announcements</Text>
              {(announcements ?? []).slice(0, 3).map((ann) => (
                <View key={ann.id} style={styles.annRow}>
                  <View style={[styles.annDot, { backgroundColor: colors.purple }]} />
                  <Text style={styles.annTitle} numberOfLines={2}>{ann.title}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            {[
              { label: "Reports", icon: "file-text", color: colors.primary, route: "/reports" },
              { label: "Messages", icon: "message-circle", color: colors.purple, route: "/messages" },
            ].map(({ label, icon, color, route }) => (
              <Pressable key={label} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.7 : 1, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
                <Feather name={icon as any} size={18} color={color} />
                <Text style={[styles.quickBtnText, { color: colors.foreground }]}>{label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function TeacherDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const today = DAY_NAMES[new Date().getDay()] ?? "Monday";
  const [refreshing, setRefreshing] = useState(false);

  const { data: timetable, isLoading: loadingT, refetch: refetchT } = useListTimetableEntries();
  const { data: approvals, isLoading: loadingApp, refetch: refetchApp } = useListApprovals({});
  const { data: announcements, isLoading: loadingAnn, refetch: refetchAnn } = useListAnnouncements({});

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchT(), refetchApp(), refetchAnn()]);
    setRefreshing(false);
  };

  const todayEntries = (timetable ?? []).filter(
    (e) => e.day_of_week?.toLowerCase() === today.toLowerCase()
  );
  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const isLoading = loadingT && loadingApp && loadingAnn;

  const styles = makeDashStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.subGreeting}>{today}'s overview</Text>
        </View>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "T"}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Today's Classes" value={todayEntries.length} icon="book" color={colors.orange} colors={colors} />
            <StatCard label="Pending" value={pending.length} icon="clock" color={colors.warning} colors={colors} />
            <StatCard label="Updates" value={announcements?.length ?? 0} icon="bell" color={colors.purple} colors={colors} />
          </View>

          {todayEntries.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Classes</Text>
              {todayEntries.map((e) => (
                <View key={e.id} style={styles.classRow}>
                  <View style={styles.classTime}>
                    <Text style={styles.classTimeText}>{e.start_time}</Text>
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{e.subject_name ?? "Class"}</Text>
                    {e.room ? <Text style={styles.classRoom}>{e.room}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            {[
              { label: "My Classes", icon: "layers", color: colors.purple, route: "/classes" },
              { label: "Messages", icon: "message-circle", color: "#06b6d4", route: "/messages" },
            ].map(({ label, icon, color, route }) => (
              <Pressable key={label} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.7 : 1, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
                <Feather name={icon as any} size={18} color={color} />
                <Text style={[styles.quickBtnText, { color: colors.foreground }]}>{label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function AdminDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: approvals, refetch: refetchApp } = useListApprovals({});
  const { data: announcements, refetch: refetchAnn } = useListAnnouncements({});

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchApp(), refetchAnn()]);
    setRefreshing(false);
  };

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const styles = makeDashStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.subGreeting}>Admin overview</Text>
        </View>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? "A"}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Pending" value={pending.length} icon="alert-circle" color={colors.warning} colors={colors} />
        <StatCard label="Announcements" value={announcements?.length ?? 0} icon="bell" color={colors.purple} colors={colors} />
      </View>

      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Needs Attention</Text>
          {pending.slice(0, 3).map((a) => (
            <View key={a.id} style={[styles.alertCard, { borderColor: colors.warning + "40", backgroundColor: colors.warning + "08" }]}>
              <Feather name="alert-circle" size={16} color={colors.warning} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{a.title}</Text>
                {a.description ? <Text style={styles.alertDesc} numberOfLines={1}>{a.description}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        {[
          { label: "Admin Panel", icon: "shield", color: colors.primary, route: "/admin" },
          { label: "Messages", icon: "message-circle", color: "#06b6d4", route: "/messages" },
          { label: "Reports", icon: "file-text", color: colors.orange, route: "/reports" },
        ].map(({ label, icon, color, route }) => (
          <Pressable key={label} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.7 : 1, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
            <Feather name={icon as any} size={18} color={color} />
            <Text style={[styles.quickBtnText, { color: colors.foreground }]}>{label}</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

export default function HomeTab() {
  const { role, loading } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (role === "parent") return <ParentDashboard />;
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "admin") return <AdminDashboard />;
  return <StudentDashboard />;
}

// @ts-ignore
const makeDashStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
      padding: 16,
      paddingTop: Platform.OS === "web" ? 67 + 16 : 16,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) + 80,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    greeting: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subGreeting: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    avatarSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSmallText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.primaryForeground,
    },
    centered: {
      alignItems: "center",
      paddingTop: 40,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 24,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 12,
    },
    classRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      gap: 12,
    },
    classTime: {
      backgroundColor: colors.primary + "15",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      minWidth: 52,
      alignItems: "center",
    },
    classTimeText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    classInfo: {
      flex: 1,
    },
    className: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    classRoom: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    annRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    annDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
    },
    annTitle: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      lineHeight: 20,
    },
    alertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginBottom: 8,
    },
    alertContent: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    alertDesc: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    quickBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
      marginBottom: 8,
      gap: 12,
    },
    quickBtnText: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
  });
