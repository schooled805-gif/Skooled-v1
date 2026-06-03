import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useListTimetableEntries } from "@workspace/api-client-react";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const TODAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];

function timeToMins(t: string) {
  const [h, m] = (t ?? "").split(":").map(Number);
  return h * 60 + (m ?? 0);
}

const TYPE_COLORS: Record<string, string> = {
  lesson: "#f97316",
  sport: "#3b82f6",
  exam: "#ef4444",
  lab: "#10b981",
};

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const role = profile?.role ?? "student";
  const [selectedDay, setSelectedDay] = useState(
    DAYS.includes(TODAY) ? TODAY : "Monday"
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const accent = (colors as any)[`${role}Accent`] ?? colors.primary;

  const { data: entries, isLoading } = useListTimetableEntries();

  const dayEntries = (entries ?? [])
    .filter((e: any) => e.day_of_week?.toLowerCase() === selectedDay.toLowerCase())
    .sort((a: any, b: any) => timeToMins(a.start_time) - timeToMins(b.start_time));

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const isCurrentClass = (e: any) => {
    if (selectedDay !== TODAY) return false;
    const start = timeToMins(e.start_time);
    const end = timeToMins(e.end_time);
    return nowMins >= start && nowMins < end;
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 16,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    dayRow: { paddingHorizontal: 16, paddingVertical: 12 },
    dayBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
    },
    dayLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
    entryCard: {
      marginHorizontal: 20,
      marginBottom: 10,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    timeCol: { width: 60, alignItems: "center" },
    timeText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    timeDash: { fontSize: 12, color: colors.mutedForeground },
    subject: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    typeBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 6,
    },
    typeBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
    nowBadge: {
      backgroundColor: accent + "20",
      borderColor: accent,
    },
    emptyState: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 10 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Schedule</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
        {DAYS.map((d) => {
          const isSelected = d === selectedDay;
          const isToday = d === TODAY;
          return (
            <Pressable
              key={d}
              style={[
                s.dayBtn,
                {
                  backgroundColor: isSelected ? accent : isToday ? accent + "14" : colors.secondary,
                },
              ]}
              onPress={() => setSelectedDay(d)}
            >
              <Text
                style={[
                  s.dayLabel,
                  { color: isSelected ? "#fff" : isToday ? accent : colors.foreground },
                ]}
              >
                {d.slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : dayEntries.length === 0 ? (
        <View style={s.emptyState}>
          <Feather name="coffee" size={36} color={colors.mutedForeground} />
          <Text style={s.emptyText}>No classes on {selectedDay}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {dayEntries.map((entry: any) => {
            const isCurrent = isCurrentClass(entry);
            const typeColor = TYPE_COLORS[entry.type ?? "lesson"] ?? colors.primary;
            return (
              <View
                key={entry.id}
                style={[
                  s.entryCard,
                  isCurrent && { borderColor: accent, borderWidth: 2 },
                ]}
              >
                <View style={s.timeCol}>
                  <Text style={s.timeText}>{entry.start_time?.slice(0, 5)}</Text>
                  <Text style={s.timeDash}>|</Text>
                  <Text style={s.timeText}>{entry.end_time?.slice(0, 5)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {isCurrent && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: accent }}>
                        NOW
                      </Text>
                    </View>
                  )}
                  <Text style={s.subject}>{entry.subject_name ?? entry.class_name ?? "Class"}</Text>
                  <Text style={s.meta}>
                    {[entry.teacher_name, entry.room_name].filter(Boolean).join(" · ")}
                  </Text>
                  {entry.type && (
                    <View style={[s.typeBadge, { backgroundColor: typeColor + "20" }]}>
                      <Text style={[s.typeBadgeText, { color: typeColor }]}>
                        {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
