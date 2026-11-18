import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from "react-native";

import { getGymById, type Gym } from "@/lib/gymService";
import { getWallsByGymId, type Wall } from "@/lib/wallService";

const TEMP_GYM_COVER =
  "https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=85";

// ----------------------------------------
// GYM PRESENTATION
// ----------------------------------------

type GymPresentation = {
  colour: string;
  emoji: string;
};

const gymData: Record<string, GymPresentation> = {
  "9 Degrees": {
    colour: "#D7E65A",
    emoji: "🧗",
  },

  Nomad: {
    colour: "#FF8B75",
    emoji: "⛰️",
  },

  "Climb Fit": {
    colour: "#7B9BFF",
    emoji: "🧗‍♀️",
  },
};

// ----------------------------------------
// GYM DETAIL SCREEN
// ----------------------------------------

export default function GymDetailScreen() {
  const params = useLocalSearchParams<{
    gymId?: string | string[];
  }>();

  const rawGymId = params.gymId;
  const gymId = Array.isArray(rawGymId) ? rawGymId[0] : rawGymId;

  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  // ----------------------------------------
  // THEME
  // ----------------------------------------

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

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [gymRecord, setGymRecord] = useState<Gym | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);

  const [loading, setLoading] = useState(true);
  const [wallsLoading, setWallsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [wallsError, setWallsError] = useState<string | null>(null);

  // ----------------------------------------
  // FETCH GYM AND WALLS FROM SUPABASE
  // ----------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function loadGymAndWalls() {
      setLoading(true);
      setWallsLoading(true);

      setError(null);
      setWallsError(null);

      setGymRecord(null);
      setWalls([]);

      if (!gymId) {
        if (isMounted) {
          setError("Invalid gym ID.");
          setLoading(false);
          setWallsLoading(false);
        }
        return;
      }

      try {
        console.log("Loading gym with ID:", gymId);

        // Fetch gym
        const gymResult = await getGymById(gymId);

        if (!isMounted) return;

        if (!gymResult) {
          setError("Gym not found.");
          setLoading(false);
          setWallsLoading(false);
          return;
        }

        console.log("Gym loaded successfully:", gymResult.name);

        setGymRecord(gymResult);
        setLoading(false);

        // Fetch walls belonging to this gym
        try {
          console.log("Loading walls for gym:", gymId);

          const wallsResult = await getWallsByGymId(gymId);

          if (!isMounted) return;

          console.log("Walls loaded successfully:", wallsResult);

          setWalls(wallsResult);
        } catch (wallErr) {
          console.error("Error loading walls:", wallErr);

          if (isMounted) {
            setWallsError("Unable to load walls. Please try again.");
          }
        } finally {
          if (isMounted) {
            setWallsLoading(false);
          }
        }
      } catch (err) {
        console.error("Error loading gym:", err);

        if (isMounted) {
          setError("Unable to load gym details. Please try again.");
          setLoading(false);
          setWallsLoading(false);
        }
      }
    }

    loadGymAndWalls();

    return () => {
      isMounted = false;
    };
  }, [gymId]);

  // ----------------------------------------
  // LOADING SCREEN
  // ----------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />

        <ActivityIndicator size="large" color={theme.accent} />

        <Text style={styles.loadingText}>Loading gym...</Text>
      </View>
    );
  }

  // ----------------------------------------
  // ERROR SCREEN
  // ----------------------------------------

  if (error || !gymRecord) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Stack.Screen options={{ headerShown: false }} />

        <Text style={styles.title}>{error ?? "Gym not found"}</Text>

        <Pressable onPress={() => router.back()} style={styles.errorBackButton}>
          <Text style={styles.backText}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------
  // GYM PRESENTATION
  // ----------------------------------------

  const presentation = gymData[gymRecord.name];

  const gym = {
    id: gymRecord.id,
    name: gymRecord.name,
    suburb: gymRecord.suburb
      ? `${gymRecord.suburb}, ${gymRecord.city}`
      : `${gymRecord.city}, ${gymRecord.state}`,
    description:
      gymRecord.description ?? "Indoor climbing and bouldering community.",
    colour: presentation?.colour ?? "#D7E65A",
    emoji: presentation?.emoji ?? "🧗",
  };

  // ----------------------------------------
  // OPEN WALL
  // ----------------------------------------

  function openWall(wall: Wall) {
    router.push({
      pathname: "/wall/[wallId]",
      params: {
        wallId: wall.id,
        gymId: gym.id,
      },
    });
  }

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

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
          <Text style={styles.backText}>← BACK TO GYMS</Text>
        </Pressable>

        {/* GYM HERO */}

        <ImageBackground
          source={{ uri: gymRecord.image_url || TEMP_GYM_COVER }}
          resizeMode="cover"
          style={[styles.hero, { backgroundColor: gym.colour }]}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroShade} />

          <Text style={styles.heroTag}>SEND SYD · SYDNEY</Text>

          <Text style={styles.heroEmoji}>{gym.emoji}</Text>

          <View style={styles.heroBottom}>
            <Text style={styles.heroBrand}>FIND YOUR NEXT SEND.</Text>
            {!gymRecord.image_url && (
              <Text style={styles.temporaryPhotoLabel}>TEMPORARY PHOTO</Text>
            )}
          </View>
        </ImageBackground>

        {/* GYM INFORMATION */}

        <View style={styles.gymInfo}>
          <Text style={styles.eyebrow}>CLIMBING DESTINATION</Text>

          <Text style={styles.title}>{gym.name}</Text>

          <Text style={styles.location}>⌖ {gym.suburb}</Text>

          <Text style={styles.description}>{gym.description}</Text>
        </View>

        {/* WALLS */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Explore walls</Text>

            <Text style={styles.sectionSubtitle}>
              Select a wall to discover its problems
            </Text>
          </View>

          <Text style={styles.wallCount}>
            {wallsLoading ? "..." : `${walls.length} WALLS`}
          </Text>
        </View>

        {/* WALL LOADING */}

        {wallsLoading ? (
          <View style={styles.wallLoading}>
            <ActivityIndicator size="small" color={theme.accent} />

            <Text style={styles.loadingText}>Loading walls...</Text>
          </View>
        ) : wallsError ? (
          /* WALL ERROR */

          <View style={styles.emptyWalls}>
            <Text style={styles.emptyWallsTitle}>Unable to load walls</Text>

            <Text style={styles.emptyWallsText}>{wallsError}</Text>

            <Pressable
              onPress={async () => {
                try {
                  setWallsLoading(true);
                  setWallsError(null);

                  const result = await getWallsByGymId(gym.id);

                  setWalls(result);
                } catch (err) {
                  console.error("Error retrying walls:", err);
                  setWallsError("Unable to load walls. Please try again.");
                } finally {
                  setWallsLoading(false);
                }
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>TRY AGAIN ↻</Text>
            </Pressable>
          </View>
        ) : walls.length > 0 ? (
          /* WALL CARDS */

          walls.map((wall, index) => (
            <Pressable
              key={wall.id}
              onPress={() => openWall(wall)}
              style={({ pressed }) => [
                styles.wallCard,
                pressed && { opacity: 0.75 },
              ]}
            >
              <View style={styles.wallNumber}>
                <Text style={styles.wallNumberText}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>

              <View style={styles.wallInfo}>
                <Text style={styles.wallName}>{wall.name}</Text>

                <Text style={styles.wallType}>
                  {wall.wall_type ?? "Bouldering wall"}
                </Text>

                <Text style={styles.problemCount}>EXPLORE THIS WALL</Text>
              </View>

              <Text style={styles.wallArrow}>↗</Text>
            </Pressable>
          ))
        ) : (
          /* EMPTY WALLS */

          <View style={styles.emptyWalls}>
            <Text style={styles.emptyWallsTitle}>No walls added yet</Text>

            <Text style={styles.emptyWallsText}>
              Wall information will appear here once it has been added to this
              gym.
            </Text>
          </View>
        )}

        {/* COMMUNITY */}

        <View style={styles.communityCard}>
          <Text style={styles.communityTitle}>Climbed here recently?</Text>

          <Text style={styles.communitySubtitle}>
            Share your beta and help other climbers send.
          </Text>

          <Text style={styles.communityAction}>SHARE YOUR BETA ↗</Text>
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

// ----------------------------------------
// STYLES
// ----------------------------------------

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

    wallLoading: {
      paddingVertical: 35,
      alignItems: "center",
    },

    errorBackButton: {
      marginTop: 18,
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

    // GYM HERO

    hero: {
      height: 190,
      marginHorizontal: 22,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    },

    heroImage: {
      borderRadius: 20,
    },

    heroShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.24)",
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
      fontSize: 75,
    },

    heroBottom: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    heroBrand: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 2,
      textShadowColor: "rgba(0,0,0,0.65)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },

    temporaryPhotoLabel: {
      color: "#FFFFFF",
      backgroundColor: "rgba(0,0,0,0.62)",
      overflow: "hidden",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 5,
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    // GYM INFORMATION

    gymInfo: {
      paddingHorizontal: 22,
      paddingTop: 27,
    },

    eyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 2,
    },

    title: {
      color: theme.text,
      fontSize: 32,
      fontWeight: "900",
      marginTop: 8,
    },

    location: {
      color: theme.muted,
      fontSize: 13,
      marginTop: 8,
    },

    description: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 15,
      lineHeight: 19,
    },

    // SECTION HEADER

    sectionHeader: {
      paddingHorizontal: 22,
      marginTop: 36,
      marginBottom: 17,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },

    sectionSubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    wallCount: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
    },

    // WALL CARDS

    wallCard: {
      marginHorizontal: 22,
      marginBottom: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 15,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
    },

    wallNumber: {
      height: 43,
      width: 43,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },

    wallNumberText: {
      color: theme.accent,
      fontWeight: "900",
      fontSize: 13,
    },

    wallInfo: {
      flex: 1,
      marginLeft: 14,
    },

    wallName: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
    },

    wallType: {
      color: theme.muted,
      fontSize: 10,
      marginTop: 5,
    },

    problemCount: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "800",
      marginTop: 8,
    },

    wallArrow: {
      color: theme.accent,
      fontSize: 20,
    },

    // EMPTY WALLS

    emptyWalls: {
      marginHorizontal: 22,
      padding: 20,
      borderRadius: 15,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    emptyWallsTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 14,
    },

    emptyWallsText: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 8,
    },

    retryButton: {
      marginTop: 16,
      alignSelf: "flex-start",
    },

    retryText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    // COMMUNITY

    communityCard: {
      marginHorizontal: 22,
      marginTop: 22,
      padding: 20,
      borderRadius: 17,
      backgroundColor: theme.surfaceAlt,
    },

    communityTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },

    communitySubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 8,
      lineHeight: 17,
    },

    communityAction: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 17,
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
