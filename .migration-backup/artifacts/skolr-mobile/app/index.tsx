import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { session, loading } = useAuth();
  const colors = useColors();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (session) {
    if (profile && !profile.role) {
      return <Redirect href="/profile-setup" />;
    }
    return <Redirect href="/(tabs)/" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
