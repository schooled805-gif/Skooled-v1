import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      await signIn(email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign in failed", e.message ?? "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setOauthLoading(true);
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const redirectUrl = domain
        ? `https://${domain}/api/auth/callback`
        : "skolr-mobile://auth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (e: any) {
      Alert.alert("Google sign in failed", e.message ?? "Please try again.");
    } finally {
      setOauthLoading(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1 },
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
    eyeBtn: { padding: 4 },
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
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 20,
      gap: 10,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    googleBtn: {
      height: 50,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    googleBtnText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
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
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            <View style={s.logo}>
              <Ionicons name="book" size={26} color="#ffffff" />
            </View>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your Skooled portal</Text>

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
                testID="input-email"
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                testID="input-password"
              />
              <Pressable
                style={s.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, { opacity: pressed || loading ? 0.75 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              testID="button-login"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={s.btnText}>Sign in</Text>
              )}
            </Pressable>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                s.googleBtn,
                { opacity: pressed || oauthLoading ? 0.75 : 1 },
              ]}
              onPress={handleGoogleLogin}
              disabled={oauthLoading}
            >
              {oauthLoading ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={colors.foreground} />
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerText}>Don't have an account?</Text>
              <Pressable onPress={() => router.push("/(auth)/signup")}>
                <Text style={s.footerLink}>Sign up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
