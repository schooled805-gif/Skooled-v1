import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";

type Role = "admin" | "parent" | "teacher";

interface School {
  id: string;
  name: string;
  address?: string | null;
}

interface StudentResult {
  id: string;
  full_name: string;
  grade: string;
  student_number?: string | null;
}

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolMode, setSchoolMode] = useState<"join" | "create">("join");
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolAddress, setNewSchoolAddress] = useState("");
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [allStudents, setAllStudents] = useState<StudentResult[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<StudentResult[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ROLES: { r: Role; label: string; desc: string; icon: string; color: string }[] = [
    { r: "parent", label: "Parent / Guardian", desc: "Track your child's progress and messages", icon: "users", color: "#8b5cf6" },
    { r: "teacher", label: "Teacher", desc: "Manage classes and communicate with parents", icon: "book-open", color: "#22c55e" },
    { r: "admin", label: "School Administrator", desc: "Set up and manage your school on Skolr", icon: "shield", color: "#3b82f6" },
  ];

  useEffect(() => {
    if (step === 2 && (role === "parent" || role === "teacher")) {
      setLoadingSchools(true);
      fetch(`${BASE_URL}/api/schools`)
        .then((r) => r.json())
        .then((d) => setSchools(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoadingSchools(false));
    }
    if (step === 2 && role === "admin" && schoolMode === "join") {
      setLoadingSchools(true);
      fetch(`${BASE_URL}/api/schools`)
        .then((r) => r.json())
        .then((d) => setSchools(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoadingSchools(false));
    }
  }, [step, role, schoolMode]);

  useEffect(() => {
    if (step === 3 && selectedSchool) {
      setLoadingStudents(true);
      fetch(`${BASE_URL}/api/students?school_id=${selectedSchool.id}`)
        .then((r) => r.json())
        .then((d) => setAllStudents(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setLoadingStudents(false));
    }
  }, [step, selectedSchool]);

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  );
  const filteredStudents = allStudents.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.student_number?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const toggleChild = (s: StudentResult) =>
    setSelectedChildren((prev) =>
      prev.some((c) => c.id === s.id)
        ? prev.filter((c) => c.id !== s.id)
        : [...prev, s]
    );

  const canStep1 = fullName.trim() && email.trim() && password.length >= 6;
  const canStep2 =
    role === "admin"
      ? schoolMode === "create"
        ? newSchoolName.trim().length > 0
        : !!selectedSchool
      : !!selectedSchool;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw new Error(authError.message);
      if (!authData.user?.id) throw new Error("Account creation failed. Please try again.");
      if ((authData.user.identities ?? []).length === 0)
        throw new Error("An account with this email already exists. Please sign in.");

      const userId = authData.user.id;
      let schoolId: string | null = selectedSchool?.id ?? null;

      if (role === "admin" && schoolMode === "create") {
        const sr = await fetch(`${BASE_URL}/api/schools`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ name: newSchoolName.trim(), address: newSchoolAddress.trim() || undefined }),
        });
        if (!sr.ok) throw new Error("Could not create school");
        const school = await sr.json();
        schoolId = school.id;
      }

      if (!schoolId) throw new Error("No school selected.");

      const pr = await fetch(`${BASE_URL}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          user_id: userId,
          role,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          school_id: schoolId,
        }),
      });
      if (!pr.ok && pr.status !== 409) throw new Error("Profile setup failed");

      if (role === "parent" && selectedChildren.length > 0) {
        await Promise.all(
          selectedChildren.map((child) =>
            fetch(`${BASE_URL}/api/parent-student-links`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-user-id": userId },
              body: JSON.stringify({ parent_user_id: userId, student_id: child.id, school_id: schoolId }),
            })
          )
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/login");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = role === "parent" ? 4 : 3;
  const styles = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backBtn} onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Feather name="book-open" size={24} color={colors.primaryForeground} />
          </View>
          <Text style={styles.logoText}>Create account</Text>
          <Text style={styles.tagline}>Join Skolr today</Text>
        </View>

        {role && (
          <View style={styles.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressBar,
                  { backgroundColor: i <= step ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          {step === 0 && (
            <>
              <Text style={styles.cardTitle}>Who are you signing up as?</Text>
              <Text style={styles.cardDesc}>Choose the role that describes you</Text>
              {ROLES.map(({ r, label, desc, icon, color }) => (
                <Pressable
                  key={r}
                  style={[
                    styles.roleBtn,
                    {
                      borderColor: role === r ? color : colors.border,
                      backgroundColor: role === r ? color + "12" : colors.card,
                    },
                  ]}
                  onPress={() => setRole(r)}
                >
                  <View style={[styles.roleIcon, { backgroundColor: color + "20" }]}>
                    <Feather name={icon as any} size={20} color={color} />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={styles.roleLabel}>{label}</Text>
                    <Text style={styles.roleDesc}>{desc}</Text>
                  </View>
                  {role === r && <Feather name="check" size={18} color={color} />}
                </Pressable>
              ))}
              <Pressable
                style={[styles.btn, { backgroundColor: role ? colors.primary : colors.muted }]}
                onPress={() => setStep(1)}
                disabled={!role}
              >
                <Text style={[styles.btnText, { color: role ? colors.primaryForeground : colors.mutedForeground }]}>
                  Continue
                </Text>
              </Pressable>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.cardTitle}>Your details</Text>
              <Text style={styles.cardDesc}>Fill in your personal information</Text>
              {[
                { label: "Full Name", value: fullName, set: setFullName, placeholder: "Jane Smith", type: "default" as const, testID: "input-full-name" },
                { label: "Email", value: email, set: setEmail, placeholder: "jane@example.com", type: "email-address" as const, testID: "input-email" },
                { label: "Phone (optional)", value: phone, set: setPhone, placeholder: "+1 555 000 0000", type: "phone-pad" as const, testID: "input-phone" },
              ].map(({ label, value, set, placeholder, type, testID }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={set}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType={type}
                    autoCapitalize="none"
                    testID={testID}
                  />
                </View>
              ))}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password (min. 6 chars)</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    testID="input-password"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={8}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>
              <Pressable
                style={[styles.btn, { backgroundColor: canStep1 ? colors.primary : colors.muted }]}
                onPress={() => setStep(2)}
                disabled={!canStep1}
                testID="button-next-details"
              >
                <Text style={[styles.btnText, { color: canStep1 ? colors.primaryForeground : colors.mutedForeground }]}>
                  Continue
                </Text>
              </Pressable>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.cardTitle}>Your School</Text>
              <Text style={styles.cardDesc}>
                {role === "admin" ? "Create a new school or join an existing one" : "Find your school"}
              </Text>

              {role === "admin" && (
                <View style={styles.schoolModeRow}>
                  {(["create", "join"] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.schoolModeBtn,
                        { backgroundColor: schoolMode === m ? colors.primary + "15" : colors.secondary, borderColor: schoolMode === m ? colors.primary : colors.border },
                      ]}
                      onPress={() => setSchoolMode(m)}
                      testID={`tab-${m}-school`}
                    >
                      <Text style={[styles.schoolModeBtnText, { color: schoolMode === m ? colors.primary : colors.mutedForeground }]}>
                        {m === "create" ? "Create new" : "Join existing"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {role === "admin" && schoolMode === "create" ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>School Name</Text>
                    <TextInput style={styles.input} value={newSchoolName} onChangeText={setNewSchoolName} placeholder="Springfield Academy" placeholderTextColor={colors.mutedForeground} testID="input-school-name" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Address (optional)</Text>
                    <TextInput style={styles.input} value={newSchoolAddress} onChangeText={setNewSchoolAddress} placeholder="123 Main St, City" placeholderTextColor={colors.mutedForeground} testID="input-school-address" />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.searchRow}>
                    <Feather name="search" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} value={schoolSearch} onChangeText={setSchoolSearch} placeholder="Search schools…" placeholderTextColor={colors.mutedForeground} />
                  </View>
                  {loadingSchools ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                  ) : filteredSchools.length === 0 ? (
                    <Text style={styles.emptyText}>No schools found</Text>
                  ) : (
                    filteredSchools.map((s) => (
                      <Pressable
                        key={s.id}
                        style={[styles.schoolItem, { borderColor: selectedSchool?.id === s.id ? colors.primary : colors.border, backgroundColor: selectedSchool?.id === s.id ? colors.primary + "10" : colors.background }]}
                        onPress={() => setSelectedSchool(s)}
                        testID={`school-option-${s.id}`}
                      >
                        <Feather name="home" size={14} color={colors.primary} />
                        <Text style={styles.schoolName}>{s.name}</Text>
                        {selectedSchool?.id === s.id && <Feather name="check" size={14} color={colors.primary} />}
                      </Pressable>
                    ))
                  )}
                </>
              )}

              {role === "parent" ? (
                <Pressable
                  style={[styles.btn, { backgroundColor: canStep2 ? colors.primary : colors.muted }]}
                  onPress={() => setStep(3)}
                  disabled={!canStep2}
                >
                  <Text style={[styles.btnText, { color: canStep2 ? colors.primaryForeground : colors.mutedForeground }]}>Continue</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.btn, { backgroundColor: canStep2 && !submitting ? colors.primary : colors.muted }]}
                  onPress={handleSubmit}
                  disabled={!canStep2 || submitting}
                  testID="button-create-account"
                >
                  {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : (
                    <Text style={[styles.btnText, { color: canStep2 ? colors.primaryForeground : colors.mutedForeground }]}>Create Account</Text>
                  )}
                </Pressable>
              )}
            </>
          )}

          {step === 3 && role === "parent" && (
            <>
              <Text style={styles.cardTitle}>Link Your Children</Text>
              <Text style={styles.cardDesc}>Search for your child at {selectedSchool?.name}</Text>

              {selectedChildren.length > 0 && (
                <View style={styles.selectedChips}>
                  {selectedChildren.map((c) => (
                    <Pressable key={c.id} style={[styles.chip, { backgroundColor: colors.purple + "20" }]} onPress={() => toggleChild(c)}>
                      <Text style={[styles.chipText, { color: colors.purple }]}>{c.full_name}</Text>
                      <Feather name="x" size={12} color={colors.purple} />
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.searchRow}>
                <Feather name="search" size={16} color={colors.mutedForeground} style={styles.searchIcon} />
                <TextInput style={styles.searchInput} value={studentSearch} onChangeText={setStudentSearch} placeholder="Search by name or student number…" placeholderTextColor={colors.mutedForeground} />
              </View>

              {loadingStudents ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
              ) : filteredStudents.length === 0 ? (
                <Text style={styles.emptyText}>{studentSearch ? "No students match" : "No students at this school yet"}</Text>
              ) : (
                filteredStudents.map((s) => {
                  const sel = selectedChildren.some((c) => c.id === s.id);
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.schoolItem, { borderColor: sel ? colors.purple : colors.border, backgroundColor: sel ? colors.purple + "10" : colors.background }]}
                      onPress={() => toggleChild(s)}
                    >
                      <View style={[styles.studentAvatar, { backgroundColor: colors.purple + "20" }]}>
                        <Text style={[styles.studentAvatarText, { color: colors.purple }]}>{s.full_name?.[0]?.toUpperCase() ?? "?"}</Text>
                      </View>
                      <View style={styles.studentInfo}>
                        <Text style={styles.schoolName}>{s.full_name}</Text>
                        <Text style={styles.schoolAddr}>{s.grade}{s.student_number ? ` • #${s.student_number}` : ""}</Text>
                      </View>
                      {sel && <Feather name="check" size={14} color={colors.purple} />}
                    </Pressable>
                  );
                })
              )}

              <Pressable
                style={[styles.btn, { backgroundColor: submitting ? colors.muted : colors.purple }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : (
                  <Text style={styles.btnText}>
                    {selectedChildren.length > 0 ? `Finish & Link ${selectedChildren.length} Child${selectedChildren.length !== 1 ? "ren" : ""}` : "Finish"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// @ts-ignore
const makeStyles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
      paddingBottom: insets.bottom + 32,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    logoRow: { alignItems: "center", marginBottom: 24 },
    logoIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    logoText: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    tagline: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    progressRow: { flexDirection: "row", gap: 4, marginBottom: 20 },
    progressBar: { flex: 1, height: 4, borderRadius: 2 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.destructive + "15", borderRadius: 10, padding: 12, marginBottom: 16 },
    errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.destructive, flex: 1 },
    card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16 },
    cardTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 4 },
    cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 20 },
    roleBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 10, gap: 12 },
    roleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    roleText: { flex: 1 },
    roleLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    roleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 6 },
    input: { height: 46, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    passwordRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12 },
    passwordInput: { flex: 1, height: 46, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
    eyeBtn: { padding: 4 },
    btn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    schoolModeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    schoolModeBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
    schoolModeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, marginBottom: 10 },
    searchIcon: { marginRight: 6 },
    searchInput: { flex: 1, height: 44, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    emptyText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginVertical: 16 },
    schoolItem: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, gap: 10 },
    schoolName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    schoolAddr: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    selectedChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    studentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    studentAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
    studentInfo: { flex: 1 },
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
    footerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    footerLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  });
