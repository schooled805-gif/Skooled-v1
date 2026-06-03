import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getListMessagesQueryKey, useListMessages, useSendMessage } from "@workspace/api-client-react";

export default function ConversationScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const nav = useNavigation();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    nav.setOptions({ title: name ?? "Chat" });
  }, [name]);

  const { data: messages, isLoading } = useListMessages({ conversation_with: id });
  const { mutateAsync: sendMessage, isPending: sending } = useSendMessage();

  const sorted = [...(messages ?? [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const reversed = [...sorted].reverse();

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendMessage({ data: { recipient_id: id, body: text, school_id: profile?.school_id ?? "" } } as any);
      await qc.invalidateQueries({ queryKey: ["/api/messages"] });
    } catch {
      setBody(text);
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bubble: {
      maxWidth: "75%",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginHorizontal: 16,
      marginBottom: 4,
    },
    bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
    timeText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 10),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: 10,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return (
    <View style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={reversed}
            keyExtractor={(item: any) => item.id}
            inverted
            scrollEnabled={!!reversed.length}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            renderItem={({ item }: { item: any }) => {
              const isMe = item.sender_id === user?.id;
              return (
                <View
                  style={{
                    alignItems: isMe ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={[
                      s.bubble,
                      {
                        backgroundColor: isMe ? colors.primary : colors.card,
                        borderWidth: isMe ? 0 : 1,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[s.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>
                      {item.body}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.timeText,
                      { color: colors.mutedForeground, marginHorizontal: 22 },
                    ]}
                  >
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            ref={inputRef}
            style={s.input}
            value={body}
            onChangeText={setBody}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            returnKeyType="default"
          />
          <Pressable
            style={({ pressed }) => [s.sendBtn, { opacity: pressed || sending || !body.trim() ? 0.5 : 1 }]}
            onPress={handleSend}
            disabled={sending || !body.trim()}
          >
            <Feather name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
