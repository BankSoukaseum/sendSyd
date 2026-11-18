import { useState } from "react";

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { Stack, useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const theme = {
    background: isDark ? "#111512" : "#F5F4EF",
    surface: isDark ? "#1D2420" : "#FFFFFF",
    text: isDark ? "#F4F3ED" : "#202620",
    muted: isDark ? "#9AA49C" : "#777E76",
    border: isDark ? "#303A33" : "#E3E2DA",
    accent: "#D7E65A",
  };

  const styles = createStyles(theme);

  // ========================================
  // AUTHENTICATION
  // ========================================

  async function handleAuth() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert(
        "Missing information",
        "Please enter your email and password.",
      );
      return;
    }

    if (mode === "signup" && password.length < 6) {
      Alert.alert(
        "Password too short",
        "Your password must contain at least 6 characters.",
      );
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      Alert.alert(
        "Passwords don't match",
        "Please make sure both passwords are identical.",
      );
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        // SIGN IN

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error("Unable to establish your session.");
        }

        Alert.alert(
          "Welcome back!",
          "You have successfully signed in to SEND SYD.",
          [
            {
              text: "Continue",
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        // SIGN UP

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (data.session) {
          Alert.alert(
            "Account created!",
            "Welcome to SEND SYD. Your account is ready.",
            [
              {
                text: "Continue",
                onPress: () => router.back(),
              },
            ],
          );
        } else {
          Alert.alert(
            "Check your email",
            "Your account has been created. Please check your inbox for the confirmation link before signing in.",
            [
              {
                text: "OK",
                onPress: () => setMode("login"),
              },
            ],
          );
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);

      Alert.alert(
        mode === "login" ? "Login failed" : "Registration failed",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // SCREEN
  // ========================================

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* BACK BUTTON */}

          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>

          {/* BRAND */}

          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🧗</Text>
            </View>

            <Text style={styles.logo}>SEND SYD.</Text>

            <Text style={styles.tagline}>BUILT BY CLIMBERS, FOR CLIMBERS.</Text>
          </View>

          {/* HEADING */}

          <View style={styles.headingSection}>
            <Text style={styles.title}>
              {mode === "login" ? "Welcome back." : "Join the community."}
            </Text>

            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Sign in and get back to sending."
                : "Create an account and start sharing your beta."}
            </Text>
          </View>

          {/* MODE SELECTOR */}

          <View style={styles.modeSelector}>
            <Pressable
              onPress={() => setMode("login")}
              style={[
                styles.modeButton,
                mode === "login" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === "login" && styles.modeTextActive,
                ]}
              >
                LOG IN
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode("signup")}
              style={[
                styles.modeButton,
                mode === "signup" && styles.modeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === "signup" && styles.modeTextActive,
                ]}
              >
                SIGN UP
              </Text>
            </Pressable>
          </View>

          {/* FORM */}

          <View style={styles.form}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>PASSWORD</Text>

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={theme.muted}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {mode === "signup" && (
              <>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>

                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            )}

            {/* SUBMIT */}

            <Pressable
              onPress={handleAuth}
              disabled={loading}
              style={[styles.submitButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color="#191E1C" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* SWITCH MODE */}

          <View style={styles.switchSection}>
            <Text style={styles.switchText}>
              {mode === "login"
                ? "New to SEND SYD?"
                : "Already have an account?"}
            </Text>

            <Pressable
              onPress={() => {
                setMode(mode === "login" ? "signup" : "login");

                setPassword("");
                setConfirmPassword("");
              }}
            >
              <Text style={styles.switchAction}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          {/* FOOTER */}

          <Text style={styles.footer}>
            SEND SYD · SYDNEY BOULDERING COMMUNITY
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ========================================
// STYLES
// ========================================

function createStyles(theme: {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 26,
      paddingTop: 55,
      paddingBottom: 35,
    },

    backButton: {
      paddingVertical: 12,
    },

    backText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },

    brandSection: {
      alignItems: "center",
      marginTop: 30,
      marginBottom: 38,
    },

    logoCircle: {
      width: 75,
      height: 75,
      borderRadius: 24,
      backgroundColor: "#D7E65A",
      justifyContent: "center",
      alignItems: "center",
    },

    logoEmoji: {
      fontSize: 39,
    },

    logo: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      letterSpacing: 3,
      marginTop: 17,
    },

    tagline: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.5,
      marginTop: 7,
    },

    headingSection: {
      marginBottom: 25,
    },

    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "900",
    },

    subtitle: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 9,
    },

    modeSelector: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 5,
      marginBottom: 25,
      borderWidth: 1,
      borderColor: theme.border,
    },

    modeButton: {
      flex: 1,
      paddingVertical: 13,
      alignItems: "center",
      borderRadius: 9,
    },

    modeButtonActive: {
      backgroundColor: "#D7E65A",
    },

    modeText: {
      color: theme.muted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    modeTextActive: {
      color: "#191E1C",
    },

    form: {
      gap: 0,
    },

    label: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 9,
    },

    input: {
      backgroundColor: theme.surface,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 11,
      paddingHorizontal: 15,
      paddingVertical: 15,
      fontSize: 13,
      marginBottom: 21,
    },

    submitButton: {
      backgroundColor: "#D7E65A",
      minHeight: 55,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 5,
    },

    disabledButton: {
      opacity: 0.5,
    },

    submitText: {
      color: "#191E1C",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },

    switchSection: {
      alignItems: "center",
      marginTop: 28,
      gap: 8,
    },

    switchText: {
      color: theme.muted,
      fontSize: 11,
    },

    switchAction: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "900",
    },

    footer: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 45,
    },
  });
}
