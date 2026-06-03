import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Feather name="mail" size={32} color={colors.mutedForeground} />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.desc}>
          Password reset is managed by your school administrator. Please contact them directly to reset your password.
        </Text>

        <Pressable
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/login")}
          testID="button-back-to-login"
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Back to Login</Text>
        </Pressable>
      </View>
    </View>
  );
}

// @ts-ignore
const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 40,
    },
    content: {
      alignItems: "center",
      paddingHorizontal: 8,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 12,
    },
    desc: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 32,
    },
    btn: {
      height: 50,
      borderRadius: 12,
      paddingHorizontal: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
  });
