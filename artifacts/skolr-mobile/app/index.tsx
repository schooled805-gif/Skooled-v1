import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RootIndex() {
  const { user, profile, loading, profileLoading } = useAuth();
  const colors = useColors();

  if (loading || (user && profileLoading)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!profile) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)" />;
}
