import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";

import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { getGymById, type Gym } from "@/lib/gymService";
import { getWallById, type Wall } from "@/lib/wallService";

import {
    getActiveRotationByWallId,
    getRotationsByWallId,
    type Rotation,
} from "@/lib/rotationService";

import { getProblemsByRotationId, type Problem } from "@/lib/problemService";

const gymColours: Record<string, string> = {
  "9 Degrees": "#D7E65A",
  Nomad: "#FF8B75",
  "Climb Fit": "#7B9BFF",
};

export default function WallScreen() {
  const params = useLocalSearchParams<{
    wallId?: string | string[];
  }>();

  const rawWallId = params.wallId;
  const wallId = Array.isArray(rawWallId) ? rawWallId[0] : rawWallId;

  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const theme = {
    background: isDark ? "#111512" : "#F5F4EF",
    surface: isDark ? "#1D2420" : "#FFFFFF",
    surfaceAlt: isDark ? "#252D28" : "#EBEAE3",
    text: isDark ? "#F4F3ED" : "#202620",
    muted: isDark ? "#9AA49C" : "#777E76",
    border: isDark ? "#303A33" : "#E3E2DA",
    accent: isDark ? "#D7E65A" : "#65751D",
  };

  const styles = createStyles(theme);

  const [wall, setWall] = useState<Wall | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);

  const [activeRotation, setActiveRotation] = useState<Rotation | null>(null);

  const [rotationHistory, setRotationHistory] = useState<Rotation[]>([]);

  const [problems, setProblems] = useState<Problem[]>([]);

  const [loading, setLoading] = useState(true);
  const [rotationLoading, setRotationLoading] = useState(false);

  const [problemsLoading, setProblemsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [problemsError, setProblemsError] = useState<string | null>(null);

  // ========================================
  // LOAD WALL AND GYM
  // ========================================

  useEffect(() => {
    let isMounted = true;

    async function loadWall() {
      setLoading(true);
      setError(null);
      setWall(null);
      setGym(null);
      setActiveRotation(null);
      setRotationHistory([]);
      setProblems([]);

      if (!wallId) {
        setError("Invalid wall ID.");
        setLoading(false);
        return;
      }

      try {
        const wallResult = await getWallById(wallId);

        if (!isMounted) return;

        if (!wallResult || !wallResult.is_active) {
          setError("Wall not found.");
          setLoading(false);
          return;
        }

        setWall(wallResult);

        const gymResult = await getGymById(wallResult.gym_id);

        if (!isMounted) return;

        if (!gymResult) {
          setError("The associated gym could not be found.");
          setLoading(false);
          return;
        }

        setGym(gymResult);
        setLoading(false);
      } catch (err) {
        console.error("Error loading wall:", err);

        if (isMounted) {
          setError("Unable to load wall details.");
          setLoading(false);
        }
      }
    }

    loadWall();

    return () => {
      isMounted = false;
    };
  }, [wallId]);

  // ========================================
  // LOAD ROTATIONS
  // ========================================

  useEffect(() => {
    let isMounted = true;

    async function loadRotations() {
      if (!wall?.id) return;

      setRotationLoading(true);

      try {
        const [active, history] = await Promise.all([
          getActiveRotationByWallId(wall.id),
          getRotationsByWallId(wall.id),
        ]);

        if (!isMounted) return;

        setActiveRotation(active);
        setRotationHistory(history);
      } catch (err) {
        console.error("Error loading rotations:", err);

        if (isMounted) {
          setActiveRotation(null);
          setRotationHistory([]);
        }
      } finally {
        if (isMounted) {
          setRotationLoading(false);
        }
      }
    }

    loadRotations();

    return () => {
      isMounted = false;
    };
  }, [wall?.id]);

  // ========================================
  // LOAD PROBLEMS
  // ========================================

  useEffect(() => {
    let isMounted = true;

    async function loadProblems() {
      setProblems([]);
      setProblemsError(null);

      if (!activeRotation?.id) {
        setProblemsLoading(false);
        return;
      }

      setProblemsLoading(true);

      try {
        const result = await getProblemsByRotationId(activeRotation.id);

        if (!isMounted) return;

        setProblems(result);
      } catch (err) {
        console.error("Error loading problems:", err);

        if (isMounted) {
          setProblemsError("Unable to load problems.");
        }
      } finally {
        if (isMounted) {
          setProblemsLoading(false);
        }
      }
    }

    loadProblems();

    return () => {
      isMounted = false;
    };
  }, [activeRotation?.id]);

  // ========================================
  // DATE FORMATTER
  // ========================================

  function formatDate(date: string | null) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // ========================================
  // LOADING SCREEN
  // ========================================

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />

        <ActivityIndicator size="large" color={theme.accent} />

        <Text style={styles.loadingText}>Loading wall...</Text>
      </View>
    );
  }

  // ========================================
  // ERROR SCREEN
  // ========================================

  if (error || !wall || !gym) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />

        <Text style={styles.title}>{error ?? "Wall not found"}</Text>

        <Pressable onPress={() => router.back()} style={styles.errorBackButton}>
          <Text style={styles.backText}>← GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const gymColour = gymColours[gym.name] ?? "#D7E65A";

  const gymLocation = gym.suburb
    ? `${gym.suburb}, ${gym.city}`
    : `${gym.city}, ${gym.state}`;

  // ========================================
  // MAIN SCREEN
  // ========================================

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK TO GYM</Text>
        </Pressable>

        {/* HERO */}

        <View style={[styles.hero, { backgroundColor: gymColour }]}>
          <Text style={styles.heroTag}>SEND SYD · SYDNEY</Text>

          <Text style={styles.heroEmoji}>🧗</Text>

          <Text style={styles.heroBrand}>FIND YOUR NEXT SEND.</Text>
        </View>

        {/* WALL INFORMATION */}

        <View style={styles.wallInfo}>
          <Text style={styles.eyebrow}>
            {gym.name.toUpperCase()} · {gymLocation.toUpperCase()}
          </Text>

          <Text style={styles.title}>{wall.name}</Text>

          <Text style={styles.wallType}>
            {wall.wall_type ?? "Bouldering wall"}
          </Text>

          <Text style={styles.subtitle}>
            {wall.description ??
              "Explore the problems on this wall and find your next project."}
          </Text>
        </View>

        {/* CURRENT ROTATION */}

        <View style={styles.rotationCard}>
          <View style={styles.rotationInfo}>
            <Text style={styles.rotationLabel}>CURRENT ROTATION</Text>

            {rotationLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.accent}
                style={{ alignSelf: "flex-start", marginTop: 10 }}
              />
            ) : activeRotation ? (
              <>
                <Text style={styles.rotationNumber}>{activeRotation.name}</Text>

                <Text style={styles.rotationNote}>
                  Started {formatDate(activeRotation.started_at)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.rotationNumber}>Not set</Text>

                <Text style={styles.rotationNote}>
                  No active rotation found.
                </Text>
              </>
            )}
          </View>

          {activeRotation && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />

              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          )}
        </View>

        {/* PROBLEM SECTION HEADER */}

        <View style={styles.sectionHeader}>
          <View style={styles.problemHeading}>
            <Text style={styles.sectionTitle}>Boulder problems</Text>

            <Text style={styles.sectionSubtitle}>
              {problems.length} approved{" "}
              {problems.length === 1 ? "problem" : "problems"}
            </Text>
          </View>

          <Pressable
            disabled={!activeRotation}
            onPress={() =>
              router.push({
                pathname: "/problem/create",
                params: { wallId: wall.id },
              })
            }
            style={[
              styles.addProblemButton,
              !activeRotation && styles.disabledButton,
            ]}
          >
            <Text style={styles.addProblemText}>+ ADD PROBLEM</Text>
          </Pressable>
        </View>

        {/* PROBLEM LIST */}

        {problemsLoading ? (
          <View style={styles.problemLoading}>
            <ActivityIndicator size="large" color={theme.accent} />

            <Text style={styles.loadingText}>Loading problems...</Text>
          </View>
        ) : problemsError ? (
          <View style={styles.emptyProblems}>
            <Text style={styles.emptyTitle}>Couldn't load problems</Text>

            <Text style={styles.emptyDescription}>{problemsError}</Text>
          </View>
        ) : problems.length === 0 ? (
          <View style={styles.emptyProblems}>
            <Text style={styles.emptyIcon}>🧗</Text>

            <Text style={styles.emptyTitle}>No problems added yet</Text>

            <Text style={styles.emptyDescription}>
              Be the first to document a climb on this wall. Submitted problems
              will appear here after approval.
            </Text>
          </View>
        ) : (
          <View style={styles.problemList}>
            {problems.map((problem, index) => (
              <Pressable
                key={problem.id}
                onPress={() =>
                  router.push({
                    pathname: "/problem/[problemId]",
                    params: { problemId: problem.id },
                  })
                }
                style={({ pressed }) => [
                  styles.problemCard,
                  pressed && styles.problemCardPressed,
                ]}
              >
                <View
                  style={[
                    styles.problemColour,
                    {
                      backgroundColor: problem.hold_colour_hex ?? "#89938B",
                    },
                  ]}
                />

                <View style={styles.problemDetails}>
                  <Text style={styles.problemNumber}>
                    PROBLEM {String(index + 1).padStart(2, "0")}
                  </Text>

                  <Text style={styles.problemName}>{problem.name}</Text>

                  <View style={styles.problemMeta}>
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeText}>
                        {problem.grade_label}
                      </Text>
                    </View>

                    {problem.v_grade && (
                      <Text style={styles.problemMetaText}>
                        {problem.v_grade}
                      </Text>
                    )}

                    <Text style={styles.problemMetaText}>
                      {problem.hold_colour}
                    </Text>
                  </View>

                  {problem.wall_angle && (
                    <Text style={styles.problemAngle}>
                      {problem.wall_angle}
                    </Text>
                  )}
                </View>

                <Text style={styles.problemArrow}>→</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ROTATION HISTORY */}

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Rotation history</Text>

          <Text style={styles.historyDescription}>
            Previous rotations remain available after a wall reset.
          </Text>

          {rotationLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.accent}
              style={{ marginTop: 18 }}
            />
          ) : rotationHistory.filter((rotation) => !rotation.is_active)
              .length === 0 ? (
            <Text style={styles.historyDescription}>
              No previous rotations yet.
            </Text>
          ) : (
            rotationHistory
              .filter((rotation) => !rotation.is_active)
              .map((rotation) => (
                <View key={rotation.id} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <Text style={styles.historyItemName}>{rotation.name}</Text>

                    <Text style={styles.completedLabel}>COMPLETED</Text>
                  </View>

                  <Text style={styles.historyDescription}>
                    {formatDate(rotation.started_at)}
                    {" – "}
                    {formatDate(rotation.ended_at)}
                  </Text>
                </View>
              ))
          )}
        </View>

        {/* FOOTER */}

        <View style={styles.footer}>
          <Text style={styles.footerLogo}>SEND SYD.</Text>

          <Text style={styles.footerText}>
            Built by climbers, for climbers.
          </Text>
        </View>
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
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },

    centerContent: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 25,
    },

    content: {
      paddingTop: 60,
      paddingBottom: 40,
    },

    loadingText: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 14,
      fontWeight: "700",
    },

    errorBackButton: {
      marginTop: 22,
      padding: 12,
    },

    backButton: {
      paddingHorizontal: 22,
      paddingVertical: 12,
      marginBottom: 16,
    },

    backText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },

    // HERO

    hero: {
      height: 170,
      marginHorizontal: 22,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },

    heroTag: {
      position: "absolute",
      top: 16,
      left: 16,
      color: "#202620",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
    },

    heroEmoji: {
      fontSize: 68,
    },

    heroBrand: {
      position: "absolute",
      bottom: 15,
      right: 16,
      color: "rgba(0,0,0,0.4)",
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 2,
    },

    // WALL INFORMATION

    wallInfo: {
      paddingHorizontal: 22,
      paddingTop: 27,
    },

    eyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
      lineHeight: 16,
    },

    title: {
      color: theme.text,
      fontSize: 32,
      fontWeight: "900",
      marginTop: 9,
    },

    wallType: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 8,
    },

    subtitle: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 12,
    },

    // ROTATION

    rotationCard: {
      marginHorizontal: 22,
      marginTop: 26,
      padding: 18,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    rotationInfo: {
      flex: 1,
    },

    rotationLabel: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.5,
    },

    rotationNumber: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      marginTop: 5,
    },

    rotationNote: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 4,
    },

    activeBadge: {
      backgroundColor: theme.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginLeft: 8,
    },

    activeDot: {
      height: 7,
      width: 7,
      borderRadius: 4,
      backgroundColor: "#58C99A",
    },

    activeText: {
      color: theme.text,
      fontSize: 8,
      fontWeight: "900",
    },

    // PROBLEMS

    sectionHeader: {
      marginHorizontal: 22,
      marginTop: 35,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    problemHeading: {
      flex: 1,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
    },

    sectionSubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    addProblemButton: {
      backgroundColor: "#D7E65A",
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 9,
    },

    addProblemText: {
      color: "#191E1C",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.4,
    },

    disabledButton: {
      opacity: 0.4,
    },

    problemLoading: {
      padding: 30,
      alignItems: "center",
    },

    emptyProblems: {
      marginHorizontal: 22,
      padding: 25,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },

    emptyIcon: {
      fontSize: 35,
      marginBottom: 12,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      textAlign: "center",
    },

    emptyDescription: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 9,
      textAlign: "center",
    },

    problemList: {
      marginHorizontal: 22,
      gap: 10,
    },

    problemCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      minHeight: 100,
    },

    problemCardPressed: {
      opacity: 0.7,
    },

    problemColour: {
      width: 8,
      alignSelf: "stretch",
    },

    problemDetails: {
      flex: 1,
      paddingHorizontal: 15,
      paddingVertical: 14,
    },

    problemNumber: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.3,
    },

    problemName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 5,
    },

    problemMeta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 9,
    },

    gradeBadge: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },

    gradeText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "900",
    },

    problemMetaText: {
      color: theme.muted,
      fontSize: 10,
      fontWeight: "700",
    },

    problemAngle: {
      color: theme.muted,
      fontSize: 9,
      marginTop: 7,
    },

    problemArrow: {
      color: theme.accent,
      fontSize: 20,
      fontWeight: "800",
      paddingHorizontal: 15,
    },

    // HISTORY

    historyCard: {
      marginHorizontal: 22,
      marginTop: 25,
      padding: 19,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
    },

    historyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },

    historyDescription: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 8,
    },

    historyItem: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 14,
      paddingTop: 14,
    },

    historyItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    historyItemName: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
    },

    completedLabel: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "800",
    },

    // FOOTER

    footer: {
      alignItems: "center",
      paddingTop: 35,
    },

    footerLogo: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 2,
    },

    footerText: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 7,
    },
  });
}
