import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getGymById, type Gym } from "../../lib/gymService";
import { getProblemById, type Problem } from "../../lib/problemService";
import { supabase } from "../../lib/supabase";
import { getWallById, type Wall } from "../../lib/wallService";

type RotationInfo = {
  id: string;
  name: string;
  rotation_number: number;
  wall_id: string;
};

function formatResetDate(dateValue: string | null | undefined) {
  if (!dateValue) return "Not recorded";

  // Parse a date-only value as local calendar components to avoid timezone shifts.
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return "Not recorded";

  return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProblemDetailScreen() {
  const router = useRouter();
  const { problemId } = useLocalSearchParams<{ problemId: string }>();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [rotation, setRotation] = useState<RotationInfo | null>(null);
  const [wall, setWall] = useState<Wall | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (problemId) {
      loadProblem();
    }
  }, [problemId]);

  async function loadProblem() {
    try {
      setLoading(true);
      setError("");

      const problemData = await getProblemById(problemId);

      if (!problemData) {
        setProblem(null);
        setError("This problem could not be found or is no longer available.");
        return;
      }

      setProblem(problemData);

      const { data: rotationData, error: rotationError } = await supabase
        .from("rotations")
        .select("id, name, rotation_number, wall_id")
        .eq("id", problemData.rotation_id)
        .maybeSingle();

      if (rotationError) throw rotationError;

      if (!rotationData) {
        setError(
          "The rotation associated with this problem could not be found.",
        );
        return;
      }

      setRotation(rotationData);

      const wallData = await getWallById(rotationData.wall_id);

      if (!wallData) {
        setError("The wall associated with this problem could not be found.");
        return;
      }

      setWall(wallData);

      const gymData = await getGymById(wallData.gym_id);

      if (!gymData) {
        setError("The gym associated with this problem could not be found.");
        return;
      }

      setGym(gymData);
    } catch (err) {
      console.error("Error loading problem:", err);
      setError("Unable to load this problem. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/gyms");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D7E65A" />
        <Text style={styles.loadingText}>Loading problem...</Text>
      </View>
    );
  }

  if (error || !problem) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={36} color="#FF6B5F" />
        </View>
        <Text style={styles.errorTitle}>Problem not found</Text>
        <Text style={styles.errorText}>
          {error || "This problem is unavailable."}
        </Text>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
        <Pressable onPress={loadProblem} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={23} color="#F1F0E9" />
          </Pressable>

          <Text style={styles.headerTitle}>PROBLEM DETAILS</Text>

          <View style={{ width: 42 }} />
        </View>

        {problem.reference_photo_url ? (
          <Image
            source={{ uri: problem.reference_photo_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={48} color="#89938B" />
            <Text style={styles.placeholderText}>No reference photo</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.location}>
            <Ionicons name="location-outline" size={15} color="#D7E65A" />
            <Text style={styles.locationText}>
              {[gym?.name, wall?.name].filter(Boolean).join("  /  ")}
            </Text>
          </View>

          <Text style={styles.problemName}>{problem.name}</Text>

          <Text style={styles.rotationText}>
            {rotation?.name ?? "Rotation"}
          </Text>

          <View style={styles.gradeRow}>
            <View style={styles.gradeCard}>
              <Text style={styles.cardLabel}>GYM GRADE</Text>
              <Text style={styles.gradeValue}>{problem.grade_label}</Text>
            </View>

            <View style={styles.gradeCard}>
              <Text style={styles.cardLabel}>V-GRADE</Text>
              <Text style={styles.gradeValue}>{problem.v_grade || "—"}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROBLEM INFORMATION</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hold colour</Text>
              <View style={styles.colourContainer}>
                <View
                  style={[
                    styles.colourDot,
                    { backgroundColor: problem.hold_colour_hex || "#89938B" },
                  ]}
                />
                <Text style={styles.infoValue}>{problem.hold_colour}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Wall angle</Text>
              <Text style={styles.infoValue}>
                {problem.wall_angle || "Not specified"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rotation</Text>
              <Text style={styles.infoValue}>
                {rotation?.rotation_number ?? "—"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Set / reset date</Text>
              <Text style={styles.infoValue}>
                {formatResetDate(problem.reset_date)}
              </Text>
            </View>
          </View>

          {problem.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              <Text style={styles.bodyText}>{problem.description}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>START POSITION</Text>
            <Text style={styles.bodyText}>
              {problem.start_description ||
                "No start position details provided."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FINISH POSITION</Text>
            <Text style={styles.bodyText}>
              {problem.finish_description ||
                "No finish position details provided."}
            </Text>
          </View>

          <View style={styles.betaSection}>
            <View style={styles.betaHeader}>
              <View>
                <Text style={styles.sectionTitle}>BETA VIDEOS</Text>
                <Text style={styles.betaSubtitle}>
                  Watch how other climbers send this problem.
                </Text>
              </View>
              <Ionicons name="videocam-outline" size={25} color="#D7E65A" />
            </View>

            <View style={styles.betaEmpty}>
              <Ionicons name="play-circle-outline" size={42} color="#89938B" />
              <Text style={styles.betaEmptyTitle}>No beta videos yet</Text>
              <Text style={styles.betaEmptyText}>
                Be the first to share your beta when video uploads are
                available.
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>SEND SYD • CLIMB. SHARE. SEND.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191E1C",
  },
  center: {
    flex: 1,
    backgroundColor: "#191E1C",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  loadingText: {
    color: "#AAB2AA",
    marginTop: 14,
    fontSize: 14,
  },
  errorIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#292F2C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  errorTitle: {
    color: "#F1F0E9",
    fontSize: 23,
    fontWeight: "900",
  },
  errorText: {
    color: "#AAB2AA",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 10,
  },
  backButton: {
    backgroundColor: "#D7E65A",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 14,
    marginTop: 24,
  },
  backButtonText: {
    color: "#191E1C",
    fontWeight: "900",
  },
  retryButton: {
    padding: 14,
    marginTop: 4,
  },
  retryText: {
    color: "#D7E65A",
    fontWeight: "700",
  },
  header: {
    height: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#292F2C",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#AAB2AA",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroImage: {
    width: "100%",
    height: 290,
    backgroundColor: "#292F2C",
  },
  imagePlaceholder: {
    height: 230,
    backgroundColor: "#292F2C",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#89938B",
    marginTop: 10,
    fontSize: 13,
  },
  content: {
    padding: 22,
    paddingBottom: 45,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    color: "#AAB2AA",
    fontSize: 12,
    fontWeight: "700",
  },
  problemName: {
    color: "#F1F0E9",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  rotationText: {
    color: "#89938B",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 22,
  },
  gradeRow: {
    flexDirection: "row",
    gap: 12,
  },
  gradeCard: {
    flex: 1,
    backgroundColor: "#292F2C",
    borderRadius: 16,
    padding: 17,
  },
  cardLabel: {
    color: "#89938B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  gradeValue: {
    color: "#D7E65A",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  section: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#303A33",
    paddingTop: 20,
  },
  sectionTitle: {
    color: "#D7E65A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#303A33",
  },
  infoLabel: {
    color: "#AAB2AA",
    fontSize: 13,
  },
  infoValue: {
    color: "#F1F0E9",
    fontSize: 13,
    fontWeight: "700",
  },
  colourContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colourDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  bodyText: {
    color: "#C1C8C0",
    fontSize: 14,
    lineHeight: 23,
  },
  betaSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#303A33",
    paddingTop: 22,
  },
  betaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  betaSubtitle: {
    color: "#89938B",
    fontSize: 12,
    marginTop: -8,
  },
  betaEmpty: {
    backgroundColor: "#292F2C",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    marginTop: 18,
  },
  betaEmptyTitle: {
    color: "#F1F0E9",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },
  betaEmptyText: {
    color: "#89938B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 7,
  },
  footer: {
    color: "#657068",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 42,
  },
});
