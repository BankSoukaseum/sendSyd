import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import * as ImagePicker from "expo-image-picker";

import { supabase } from "@/lib/supabase";

import { getWallById, type Wall } from "@/lib/wallService";

import {
    getActiveRotationByWallId,
    type Rotation,
} from "@/lib/rotationService";

import { createProblem } from "@/lib/problemService";

// ========================================
// HOLD COLOUR OPTIONS
// ========================================

const HOLD_COLOURS = [
  { name: "Green", hex: "#58C99A" },
  { name: "Blue", hex: "#56B8E9" },
  { name: "Red", hex: "#FF6B5F" },
  { name: "Yellow", hex: "#D7E65A" },
  { name: "Orange", hex: "#FFB84D" },
  { name: "Purple", hex: "#CB83E8" },
  { name: "Pink", hex: "#F08CB6" },
  { name: "White", hex: "#F1F0E9" },
  { name: "Black", hex: "#292F2C" },
  { name: "Other", hex: "#89938B" },
];

const WALL_ANGLES = [
  "Slab",
  "Vertical",
  "Slight overhang",
  "30° overhang",
  "45° overhang",
  "Steep overhang",
  "Roof",
  "Mixed angle",
];

// ========================================
// CREATE PROBLEM SCREEN
// ========================================

export default function CreateProblemScreen() {
  const params = useLocalSearchParams<{
    wallId?: string | string[];
  }>();

  const rawWallId = params.wallId;

  const wallId = Array.isArray(rawWallId) ? rawWallId[0] : rawWallId;

  const router = useRouter();

  const isDark = useColorScheme() === "dark";

  // ========================================
  // THEME
  // ========================================

  const theme = {
    background: isDark ? "#111512" : "#F5F4EF",
    surface: isDark ? "#1D2420" : "#FFFFFF",
    surfaceAlt: isDark ? "#252D28" : "#EBEAE3",
    text: isDark ? "#F4F3ED" : "#202620",
    muted: isDark ? "#9AA49C" : "#777E76",
    border: isDark ? "#303A33" : "#E3E2DA",
    accent: isDark ? "#D7E65A" : "#65751D",
    input: isDark ? "#252D28" : "#FFFFFF",
  };

  const styles = createStyles(theme);

  // ========================================
  // FORM STATE
  // ========================================

  const [wall, setWall] = useState<Wall | null>(null);

  const [rotation, setRotation] = useState<Rotation | null>(null);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [signedIn, setSignedIn] = useState(false);

  const [name, setName] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [vGrade, setVGrade] = useState("");

  const [holdColour, setHoldColour] = useState("");
  const [holdColourHex, setHoldColourHex] = useState("");

  const [wallAngle, setWallAngle] = useState("");

  const [description, setDescription] = useState("");
  const [startDescription, setStartDescription] = useState("");
  const [finishDescription, setFinishDescription] = useState("");

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);

  // ========================================
  // LOAD WALL, ROTATION AND AUTH SESSION
  // ========================================

  useEffect(() => {
    let isMounted = true;

    async function loadFormData() {
      setLoading(true);

      try {
        // Check the current session without requiring
        // the user to already be authenticated.

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!isMounted) return;

        setSignedIn(!!session?.user);

        // Load the selected wall.

        if (!wallId) {
          throw new Error("No wall was selected.");
        }

        const wallResult = await getWallById(wallId);

        if (!wallResult || !wallResult.is_active) {
          throw new Error("The selected wall could not be found.");
        }

        if (!isMounted) return;

        setWall(wallResult);

        // Load its active rotation.

        const rotationResult = await getActiveRotationByWallId(wallResult.id);

        if (!isMounted) return;

        setRotation(rotationResult);

        console.log("Problem form loaded successfully.");
        console.log("Signed in:", !!session?.user);
        console.log("Wall:", wallResult.name);
        console.log("Active rotation:", rotationResult);
      } catch (error) {
        console.error("Error loading problem form:", error);

        if (isMounted) {
          Alert.alert(
            "Unable to load form",
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFormData();

    // Listen for sign-in and sign-out changes.

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSignedIn(!!session?.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [wallId]);

  // ========================================
  // SELECT REFERENCE PHOTO
  // ========================================

  async function choosePhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to select a reference photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setPhotoUri(result.assets[0].uri);
      setPhotoMimeType(result.assets[0].mimeType ?? null);
    } catch (error) {
      console.error("Photo selection error:", error);

      Alert.alert("Photo error", "Unable to select the photo.");
    }
  }

  // ========================================
  // SUBMIT PROBLEM
  // ========================================

  async function handleSubmit() {
    if (!signedIn) {
      Alert.alert(
        "Sign in required",
        "You need an account to submit a boulder problem. You can still browse SEND SYD without signing in.",
      );
      return;
    }

    if (!wall || !rotation) {
      Alert.alert(
        "No active rotation",
        "This wall needs an active rotation before a problem can be added.",
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        "Missing problem name",
        "Please enter a name for this problem.",
      );
      return;
    }

    if (!gradeLabel.trim()) {
      Alert.alert(
        "Missing grade",
        "Please enter the gym's grade for this problem.",
      );
      return;
    }

    if (!holdColour || !holdColourHex) {
      Alert.alert("Missing hold colour", "Please select the main hold colour.");
      return;
    }

    setSubmitting(true);

    try {
      // Verify the session before submitting.

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setSignedIn(false);

        throw new Error("Your session has expired. Please sign in again.");
      }

      // Upload reference photo if selected.

      let referencePhotoUrl: string | undefined;

      if (photoUri) {
        const response = await fetch(photoUri);

        if (!response.ok) {
          throw new Error("Unable to read the selected reference photo.");
        }

        const arrayBuffer = await response.arrayBuffer();

        const extension = photoMimeType?.includes("png")
          ? "png"
          : photoMimeType?.includes("webp")
            ? "webp"
            : "jpg";

        const contentType =
          extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "image/jpeg";

        const filePath = `${session.user.id}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("problem-photos")
          .upload(filePath, arrayBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("problem-photos")
          .getPublicUrl(filePath);

        referencePhotoUrl = publicUrlData.publicUrl;
      }

      // Create pending problem.

      await createProblem({
        rotationId: rotation.id,
        name,
        gradeLabel,
        vGrade,
        holdColour,
        holdColourHex,
        wallAngle,
        description,
        referencePhotoUrl,
        startDescription,
        finishDescription,
      });

      Alert.alert(
        "Problem submitted!",
        "Your problem has been submitted for review. It will appear on the wall once approved.",
        [
          {
            text: "Back to wall",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("Problem submission error:", error);

      Alert.alert(
        "Submission failed",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />

        <ActivityIndicator size="large" color={theme.accent} />

        <Text style={styles.loadingText}>Preparing problem form...</Text>
      </View>
    );
  }

  // ========================================
  // MAIN SCREEN
  // ========================================

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>SEND SYD · COMMUNITY</Text>

          <Text style={styles.title}>Add a problem.</Text>

          <Text style={styles.subtitle}>
            Document a climb and share it with the Sydney bouldering community.
          </Text>
        </View>

        {/* WALL INFORMATION */}

        <View style={styles.locationCard}>
          <Text style={styles.fieldLabel}>SELECTED WALL</Text>

          <Text style={styles.locationName}>
            {wall?.name ?? "Wall unavailable"}
          </Text>

          <Text style={styles.locationDetail}>
            {rotation?.name ?? "No active rotation"}
          </Text>
        </View>

        {/* SIGN-IN NOTICE */}

        {!signedIn && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>
              Sign in required to contribute
            </Text>

            <Text style={styles.warningText}>
              You can browse SEND SYD without an account. To submit a problem,
              you'll need to sign in or create an account.
            </Text>

            <Pressable
              onPress={() => {
                router.push("/auth");
              }}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>
                SIGN IN / CREATE ACCOUNT →
              </Text>
            </Pressable>
          </View>
        )}

        {!rotation && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>No active rotation</Text>

            <Text style={styles.warningText}>
              A problem cannot be submitted until this wall has an active
              rotation.
            </Text>
          </View>
        )}

        {/* PROBLEM DETAILS */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>01 · Problem details</Text>

          <Text style={styles.fieldLabel}>PROBLEM NAME *</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Green Machine"
            placeholderTextColor={theme.muted}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>

          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the climb, style or anything useful..."
            placeholderTextColor={theme.muted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        {/* GRADES */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>02 · Difficulty</Text>

          <Text style={styles.fieldLabel}>GYM GRADE *</Text>

          <TextInput
            style={styles.input}
            value={gradeLabel}
            onChangeText={setGradeLabel}
            placeholder="e.g. 6, Blue, or V4"
            placeholderTextColor={theme.muted}
            maxLength={20}
          />

          <Text style={styles.helperText}>
            Enter the grade used by this gym.
          </Text>

          <Text style={styles.fieldLabel}>V-SCALE EQUIVALENT (OPTIONAL)</Text>

          <TextInput
            style={styles.input}
            value={vGrade}
            onChangeText={setVGrade}
            placeholder="e.g. V4"
            placeholderTextColor={theme.muted}
            maxLength={10}
          />
        </View>

        {/* HOLD COLOUR */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>03 · Hold colour</Text>

          <Text style={styles.fieldLabel}>MAIN HOLD COLOUR *</Text>

          <View style={styles.colourGrid}>
            {HOLD_COLOURS.map((colour) => {
              const selected = holdColour === colour.name;

              return (
                <Pressable
                  key={colour.name}
                  onPress={() => {
                    setHoldColour(colour.name);
                    setHoldColourHex(colour.hex);
                  }}
                  style={[
                    styles.colourOption,
                    selected && styles.colourOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.colourSwatch,
                      { backgroundColor: colour.hex },
                    ]}
                  />

                  <Text style={styles.colourName}>{colour.name}</Text>

                  {selected && <Text style={styles.selectedMark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* WALL ANGLE */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>04 · Wall angle</Text>

          <Text style={styles.fieldLabel}>SELECT WALL ANGLE</Text>

          <View style={styles.angleGrid}>
            {WALL_ANGLES.map((angle) => {
              const selected = wallAngle === angle;

              return (
                <Pressable
                  key={angle}
                  onPress={() => setWallAngle(selected ? "" : angle)}
                  style={[
                    styles.angleOption,
                    selected && styles.angleOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.angleText,
                      selected && styles.angleTextSelected,
                    ]}
                  >
                    {angle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* START AND FINISH */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>05 · Climbing details</Text>

          <Text style={styles.fieldLabel}>STARTING HOLDS</Text>

          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={startDescription}
            onChangeText={setStartDescription}
            placeholder="Describe the starting holds..."
            placeholderTextColor={theme.muted}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>FINISHING HOLDS</Text>

          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={finishDescription}
            onChangeText={setFinishDescription}
            placeholder="Describe the finishing hold..."
            placeholderTextColor={theme.muted}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
        </View>

        {/* REFERENCE PHOTO */}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>06 · Reference photo</Text>

          <Text style={styles.fieldLabel}>UPLOAD WALL PHOTO</Text>

          {photoUri ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />

              <Pressable
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoMimeType(null);
                }}
                style={styles.removePhotoButton}
              >
                <Text style={styles.removePhotoText}>REMOVE PHOTO ×</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={choosePhoto} style={styles.photoPicker}>
              <Text style={styles.photoIcon}>＋</Text>

              <Text style={styles.photoTitle}>Add reference photo</Text>

              <Text style={styles.photoSubtitle}>
                Select an image from your gallery
              </Text>
            </Pressable>
          )}
        </View>

        {/* COMMUNITY NOTICE */}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Community review</Text>

          <Text style={styles.noticeText}>
            Your submission will be marked as pending until it has been
            reviewed. It will only appear publicly once approved.
          </Text>
        </View>

        {/* SUBMIT */}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !signedIn || !rotation || !wall}
          style={[
            styles.submitButton,
            (submitting || !signedIn || !rotation || !wall) &&
              styles.submitButtonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#191E1C" />
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT PROBLEM →</Text>
          )}
        </Pressable>

        <Text style={styles.footerText}>
          SEND SYD · BUILT BY CLIMBERS, FOR CLIMBERS.
        </Text>
      </ScrollView>
    </View>
  );
}

// ========================================
// STYLES
// ========================================

function createStyles(theme: {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  input: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    centerContent: {
      justifyContent: "center",
      alignItems: "center",
    },

    content: {
      paddingTop: 55,
      paddingHorizontal: 22,
      paddingBottom: 45,
    },

    loadingText: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 14,
      fontWeight: "700",
    },

    backButton: {
      paddingVertical: 12,
      marginBottom: 16,
    },

    backText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },

    header: {
      marginBottom: 25,
    },

    eyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
    },

    title: {
      color: theme.text,
      fontSize: 34,
      fontWeight: "900",
      marginTop: 10,
    },

    subtitle: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 10,
    },

    locationCard: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 14,
      padding: 17,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },

    fieldLabel: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.1,
      marginBottom: 9,
    },

    locationName: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 4,
    },

    locationDetail: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 5,
    },

    warningCard: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#FFB84D",
      padding: 15,
      marginBottom: 18,
    },

    warningTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "900",
    },

    warningText: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 6,
    },

    signInButton: {
      backgroundColor: "#D7E65A",
      padding: 13,
      borderRadius: 9,
      marginTop: 14,
      alignItems: "center",
    },

    signInButtonText: {
      color: "#191E1C",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.5,
    },

    formSection: {
      marginBottom: 28,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "900",
      marginBottom: 17,
    },

    input: {
      backgroundColor: theme.input,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 11,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 13,
      marginBottom: 18,
    },

    multilineInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },

    helperText: {
      color: theme.muted,
      fontSize: 10,
      marginTop: -11,
      marginBottom: 17,
    },

    colourGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },

    colourOption: {
      width: "30%",
      minHeight: 72,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 11,
      backgroundColor: theme.surface,
      justifyContent: "center",
      alignItems: "center",
      padding: 8,
      position: "relative",
    },

    colourOptionSelected: {
      borderColor: theme.accent,
      borderWidth: 2,
      backgroundColor: theme.surfaceAlt,
    },

    colourSwatch: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.3)",
    },

    colourName: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 6,
    },

    selectedMark: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "900",
      position: "absolute",
      top: 5,
      right: 8,
    },

    angleGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    angleOption: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },

    angleOptionSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },

    angleText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "700",
    },

    angleTextSelected: {
      color: "#191E1C",
    },

    photoPicker: {
      height: 160,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },

    photoIcon: {
      color: theme.accent,
      fontSize: 35,
      fontWeight: "300",
    },

    photoTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 8,
    },

    photoSubtitle: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 5,
    },

    photoContainer: {
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: theme.surface,
    },

    photoPreview: {
      width: "100%",
      height: 210,
      resizeMode: "cover",
    },

    removePhotoButton: {
      padding: 13,
      alignItems: "center",
    },

    removePhotoText: {
      color: "#FF6B5F",
      fontSize: 10,
      fontWeight: "900",
    },

    noticeCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      marginBottom: 20,
    },

    noticeTitle: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "900",
    },

    noticeText: {
      color: theme.muted,
      fontSize: 10,
      lineHeight: 17,
      marginTop: 7,
    },

    submitButton: {
      backgroundColor: "#D7E65A",
      borderRadius: 12,
      minHeight: 54,
      alignItems: "center",
      justifyContent: "center",
    },

    submitButtonDisabled: {
      opacity: 0.45,
    },

    submitButtonText: {
      color: "#191E1C",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.1,
    },

    footerText: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 25,
    },
  });
}
