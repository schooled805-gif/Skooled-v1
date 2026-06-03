import { Feather, Ionicons } from "@expo/vector-icons";
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

function MenuItem({
  icon,
  label,
  onPress,
  destructive,
  rightText,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  rightText?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.accent : "transparent",
        gap: 14,
      })}
      onPress={onPress}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: destructive ? colors.destructive + "15" : colors.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather
          name={icon}
          size={18}
          color={destructive ? colors.destructive : colors.foreground}
        />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontFamily: "Inter_400Regular",
          color: destructive ? colors.destructive : colors.foreground,
        }}
      >
        {label}
      </Text>
      {rightText ? (
        <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
          {rightText}
        </Text>
      ) : (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, user, signOut } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const role = profile?.role ?? "student";
  const accent = (colors as any)[`${role}Accent`] ?? colors.primary;

  const initials = (profile?.full_name ?? user?.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingBottom: 28,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: "center",
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: accent + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: accent },
    name: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    email: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    roleBadge: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: accent + "18",
    },
    roleText: { fontSize: 13, fontFamily: "Inter_500Medium", color: accent },
    section: {
      marginTop: 20,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 6,
    },
    versionRow: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      alignItems: "center",
    },
    version: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{profile?.full_name ?? "User"}</Text>
          <Text style={s.email}>{user?.email ?? ""}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{ROLE_LABELS[role] ?? role}</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.section}>
          <MenuItem
            icon="user"
            label="Full name"
            rightText={profile?.full_name ?? "—"}
            onPress={() => {}}
          />
          <MenuItem
            icon="mail"
            label="Email"
            rightText={user?.email ?? "—"}
            onPress={() => {}}
          />
          {profile?.phone ? (
            <MenuItem
              icon="phone"
              label="Phone"
              rightText={profile.phone}
              onPress={() => {}}
            />
          ) : null}
        </View>

        <Text style={s.sectionLabel}>More</Text>
        <View style={s.section}>
          <MenuItem icon="bell" label="Notifications" onPress={() => {}} />
          <MenuItem icon="shield" label="Privacy" onPress={() => {}} />
          <MenuItem icon="help-circle" label="Help & Support" onPress={() => {}} />
        </View>

        <Text style={s.sectionLabel}>Danger zone</Text>
        <View style={s.section}>
          <MenuItem
            icon="log-out"
            label="Sign out"
            onPress={handleSignOut}
            destructive
          />
        </View>

        <View style={s.versionRow}>
          <Text style={s.version}>Skooled Mobile v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
