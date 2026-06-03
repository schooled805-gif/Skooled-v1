import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLES = [
  { value: "student", label: "Student", desc: "Access your timetable, reports & announcements" },
  { value: "parent", label: "Parent", desc: "Stay connected with your children's school life" },
  { value: "teacher", label: "Teacher", desc: "Manage classes, approvals & messages" },
  { value: "admin", label: "Administrator", desc: "Manage your school & all users" },
] as const;

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("student");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }
    if (!user) return;

    try {
      setLoading(true);
      const baseUrl = domain ? `https://${domain}` : "";
      const res = await fetch(`${baseUrl}/api/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-user-email": user.email ?? "",
        },
        body: JSON.stringify({
          user_id: user.id,
          role,
          full_name: fullName.trim(),
          email: user.email ?? "",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Failed to save profile");
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshProfile();
      router.replace("/(tabs)");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e.message ?? "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      paddingTop: topPad + 24,
      paddingBottom: insets.bottom + 32,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 32,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      marginBottom: 8,
    },
    inputWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      backgroundColor: colors.card,
      marginBottom: 28,
      paddingHorizontal: 14,
      height: 48,
      justifyContent: "center",
    },
    input: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    rolesContainer: { gap: 10, marginBottom: 32 },
    roleCard: {
      borderWidth: 1.5,
      borderRadius: colors.radius,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    roleLabel: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    roleDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    btn: {
      height: 50,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    dot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    dotInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
  });

  const roleAccent = (r: string) => {
    const map: Record<string, string> = {
      student: colors.studentAccent,
      parent: colors.parentAccent,
      teacher: colors.teacherAccent,
      admin: colors.adminAccent,
    };
    return map[r] ?? colors.primary;
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <Text style={s.title}>Complete your profile</Text>
          <Text style={s.subtitle}>Tell us a bit about yourself to get started.</Text>

          <Text style={s.label}>Full name</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Smith"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
            />
          </View>

          <Text style={s.label}>I am a...</Text>
          <View style={s.rolesContainer}>
            {ROLES.map((r) => {
              const selected = role === r.value;
              const accent = roleAccent(r.value);
              return (
                <Pressable
                  key={r.value}
                  style={({ pressed }) => [
                    s.roleCard,
                    {
                      borderColor: selected ? accent : colors.border,
                      backgroundColor: selected
                        ? accent + "12"
                        : colors.card,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <View
                    style={[
                      s.dot,
                      { borderColor: selected ? accent : colors.border },
                    ]}
                  >
                    {selected && (
                      <View
                        style={[s.dotInner, { backgroundColor: accent }]}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roleLabel, { color: selected ? accent : colors.foreground }]}>
                      {r.label}
                    </Text>
                    <Text style={[s.roleDesc, { color: colors.mutedForeground }]}>
                      {r.desc}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, { opacity: pressed || loading ? 0.75 : 1 }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={s.btnText}>Get started</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
