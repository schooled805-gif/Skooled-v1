import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Check your email",
        "We sent a confirmation link to your inbox. After confirming, sign in to complete your profile.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign up failed", e.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      paddingTop: topPad + 40,
      paddingBottom: insets.bottom + 32,
      paddingHorizontal: 24,
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 36,
    },
    label: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      backgroundColor: colors.card,
      marginBottom: 16,
      paddingHorizontal: 14,
      height: 48,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    btn: {
      height: 50,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    btnText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 24,
      gap: 4,
    },
    footerText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    footerLink: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <View style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            <View style={s.logo}>
              <Ionicons name="book" size={26} color="#ffffff" />
            </View>
            <Text style={s.title}>Create account</Text>
            <Text style={s.subtitle}>Join your school's Skooled platform</Text>

            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@school.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Text style={s.label}>Confirm password</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, { opacity: pressed || loading ? 0.75 : 1 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.btnText}>Create account</Text>
              )}
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account?</Text>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text style={s.footerLink}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
