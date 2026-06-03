import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  admin: "Administrator",
};

const ROLE_ICONS: Record<string, string> = {
  student: "book",
  parent: "users",
  teacher: "edit",
  admin: "shield",
};

export default function ProfileTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, role, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const styles = makeStyles(colors, insets);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Profile</Text>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "Loading..."}</Text>
        <View style={styles.rolePill}>
          <Feather
            name={(ROLE_ICONS[role ?? "student"] ?? "user") as any}
            size={12}
            color={colors.primaryForeground}
          />
          <Text style={styles.roleText}>{ROLE_LABELS[role ?? ""] ?? role ?? "Unknown"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="mail" size={16} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{profile?.email ?? "—"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="phone" size={16} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Phone</Text>
              <Text style={styles.rowValue}>{profile?.phone ?? "Not set"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="shield" size={16} color={colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Role</Text>
              <Text style={styles.rowValue}>{ROLE_LABELS[role ?? ""] ?? role ?? "Unknown"}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Feather name="info" size={16} color={colors.mutedForeground} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}
        onPress={handleSignOut}
        testID="sign-out-button"
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
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
      marginBottom: 24,
    },
    avatarSection: {
      alignItems: "center",
      marginBottom: 32,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    avatarText: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.primaryForeground,
    },
    name: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 8,
    },
    rolePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    roleText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    section: {
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 12,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    rowContent: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 2,
    },
    rowValue: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 58,
    },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.destructive + "12",
      borderRadius: colors.radius,
      padding: 16,
      marginTop: 8,
    },
    signOutText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.destructive,
    },
  });
