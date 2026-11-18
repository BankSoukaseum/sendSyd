import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    ActivityIndicator,
    ImageBackground,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { getGyms, type Gym } from "@/lib/gymService";

const TEMP_GYM_COVER =
  "https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=85";

// ----------------------------------------
// GYM PRESENTATION
// ----------------------------------------

type GymPresentation = {
  colour: string;
  emoji: string;
  tag: string;
};

const gymPresentation: Record<string, GymPresentation> = {
  "9 Degrees": {
    colour: "#D7E65A",
    emoji: "🧗",
    tag: "BOULDERING",
  },

  Nomad: {
    colour: "#FF8B75",
    emoji: "⛰️",
    tag: "CLIMBING",
  },

  "Sydney Indoor Bouldering Gym": {
    colour: "#7B9BFF",
    emoji: "🧗",
    tag: "BOULDERING",
  },
};

const defaultPresentation: GymPresentation = {
  colour: "#CB83E8",
  emoji: "🧗",
  tag: "CLIMBING",
};

const filters = ["All", "Nomad", "9D", "Syd Indoors"];

function getGymGroup(gym: Gym): string {
  const name = gym.name.toLowerCase();

  if (name.startsWith("nomad")) return "Nomad";
  if (name.startsWith("9 degrees")) return "9D";
  if (name.includes("sydney indoor") || name.includes("sibg")) {
    return "Syd Indoors";
  }

  return "Other";
}

// ----------------------------------------
// HELPERS
// ----------------------------------------

function getPresentation(gym: Gym): GymPresentation {
  const group = getGymGroup(gym);

  if (group === "9D") return gymPresentation["9 Degrees"];
  if (group === "Nomad") return gymPresentation.Nomad;
  if (group === "Syd Indoors") {
    return gymPresentation["Sydney Indoor Bouldering Gym"];
  }

  return defaultPresentation;
}

// ----------------------------------------
// GYMS SCREEN
// ----------------------------------------

export default function GymsScreen() {
  const router = useRouter();

  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // ----------------------------------------
  // GYM DATA
  // ----------------------------------------

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------
  // SEARCH AND FILTERS
  // ----------------------------------------

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

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
  // FETCH GYMS FROM SUPABASE
  // ----------------------------------------

  const fetchGyms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getGyms();

      setGyms(data);
    } catch (err) {
      console.error("Error fetching gyms:", err);

      setError("Unable to load gyms. Please try again.");
      setGyms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGyms();
  }, [fetchGyms]);

  // ----------------------------------------
  // FILTER GYMS
  // ----------------------------------------

  const filteredGyms = useMemo(() => {
    return gyms.filter((gym) => {
      const suburb = gym.suburb ?? "";

      const matchesSearch =
        gym.name.toLowerCase().includes(search.toLowerCase()) ||
        suburb.toLowerCase().includes(search.toLowerCase()) ||
        gym.city.toLowerCase().includes(search.toLowerCase()) ||
        (gym.description ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === "All" || getGymGroup(gym) === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [gyms, search, activeFilter]);

  // ----------------------------------------
  // OPEN GYM
  // ----------------------------------------

  function openGym(gymId: string) {
    if (!gymId) {
      console.error("Cannot open gym: missing gym UUID");
      return;
    }

    console.log("Opening gym:", gymId);

    router.push({
      pathname: "/gym/[gymId]",
      params: {
        gymId,
      },
    });
  }

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              SEND <Text style={styles.logoAccent}>SYD.</Text>
            </Text>

            <Text style={styles.eyebrow}>SYDNEY CLIMBING GUIDE</Text>
          </View>

          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>⌖</Text>

            <Text style={styles.locationText}>SYDNEY</Text>
          </View>
        </View>

        {/* INTRO */}

        <View style={styles.intro}>
          <Text style={styles.heading}>Find your gym.</Text>

          <Text style={styles.headingAccent}>Find your next send.</Text>

          <Text style={styles.subtitle}>
            Explore climbing gyms around Sydney and discover your next project.
          </Text>
        </View>

        {/* SEARCH */}

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search gym or suburb..."
            placeholderTextColor={theme.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* FILTERS */}

        <Text style={styles.filterHeading}>FILTER BY GYM</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((filter) => {
            const selected = activeFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.filterChip, selected && styles.selectedFilter]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.selectedFilterText,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* RESULTS HEADER */}

        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.sectionTitle}>Climbing gyms</Text>

            <Text style={styles.resultsSubtitle}>
              {loading
                ? "Finding climbing gyms..."
                : `${filteredGyms.length} ${
                    filteredGyms.length === 1 ? "gym" : "gyms"
                  } found`}
            </Text>
          </View>

          <Text style={styles.sortText}>SYDNEY ↘</Text>
        </View>

        {/* LOADING */}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />

            <Text style={styles.loadingText}>Loading climbing gyms...</Text>
          </View>
        )}

        {/* ERROR */}

        {!loading && error && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⚠️</Text>

            <Text style={styles.emptyTitle}>Something went wrong</Text>

            <Text style={styles.emptySubtitle}>{error}</Text>

            <Pressable onPress={fetchGyms} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* GYM CARDS */}

        {!loading &&
          !error &&
          filteredGyms.length > 0 &&
          filteredGyms.map((gym) => {
            const presentation = getPresentation(gym);

            return (
              <Pressable
                key={gym.id}
                onPress={() => openGym(gym.id)}
                style={({ pressed }) => [
                  styles.gymCard,
                  pressed && styles.cardPressed,
                ]}
              >
                {/* GYM ARTWORK */}

                <ImageBackground
                  source={{ uri: gym.image_url || TEMP_GYM_COVER }}
                  resizeMode="cover"
                  style={[
                    styles.gymArtwork,
                    {
                      backgroundColor: presentation.colour,
                    },
                  ]}
                  imageStyle={styles.gymArtworkImage}
                >
                  <View style={styles.artworkShade} />

                  <View style={styles.artworkTop}>
                    <Text style={styles.gymTag}>{presentation.tag}</Text>

                    <Text style={styles.artworkNumber}>SYDNEY</Text>
                  </View>

                  <Text style={styles.gymEmoji}>{presentation.emoji}</Text>

                  <View style={styles.artworkBottom}>
                    <Text style={styles.artworkBrand}>SEND SYD.</Text>
                    {!gym.image_url && (
                      <Text style={styles.temporaryPhotoLabel}>
                        TEMPORARY PHOTO
                      </Text>
                    )}
                  </View>
                </ImageBackground>

                {/* GYM DETAILS */}

                <View style={styles.gymDetails}>
                  <View style={styles.gymMainInfo}>
                    <View style={styles.gymNameRow}>
                      <Text style={styles.gymName}>{gym.name}</Text>

                      <Text style={styles.arrow}>↗</Text>
                    </View>

                    <Text style={styles.gymSuburb}>
                      {gym.suburb
                        ? `${gym.suburb}, ${gym.city}`
                        : `${gym.city}, ${gym.state}`}
                    </Text>

                    <View style={styles.gymFooter}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>
                          {gym.description ?? "CLIMBING"}
                        </Text>
                      </View>

                      <Text style={styles.viewDetails}>VIEW GYM →</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}

        {/* EMPTY STATE */}

        {!loading && !error && filteredGyms.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🧗</Text>

            <Text style={styles.emptyTitle}>No gyms found</Text>

            <Text style={styles.emptySubtitle}>
              Try another gym name or suburb.
            </Text>

            <Pressable
              onPress={() => {
                setSearch("");
                setActiveFilter("All");
              }}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Clear filters</Text>
            </Pressable>
          </View>
        )}

        {/* ADD GYM */}

        <View style={styles.addGymCard}>
          <Text style={styles.addGymTitle}>Missing a climbing gym?</Text>

          <Text style={styles.addGymSubtitle}>
            Help grow the Sydney climbing community.
          </Text>

          <Text style={styles.addGymAction}>SUGGEST A GYM ↗</Text>
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

    content: {
      paddingTop: 58,
      paddingBottom: 35,
    },

    // HEADER

    header: {
      paddingHorizontal: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    logo: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      letterSpacing: -1,
    },

    logoAccent: {
      color: theme.accent,
    },

    eyebrow: {
      fontSize: 9,
      color: theme.muted,
      fontWeight: "800",
      letterSpacing: 2,
      marginTop: 5,
    },

    locationBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },

    locationIcon: {
      color: theme.accent,
      fontSize: 17,
    },

    locationText: {
      color: theme.text,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    // INTRO

    intro: {
      paddingHorizontal: 22,
      marginTop: 38,
    },

    heading: {
      fontSize: 34,
      color: theme.text,
      fontWeight: "900",
      letterSpacing: -1.2,
    },

    headingAccent: {
      fontSize: 27,
      color: theme.accent,
      fontWeight: "900",
      letterSpacing: -0.8,
      marginTop: 2,
    },

    subtitle: {
      fontSize: 13,
      color: theme.muted,
      lineHeight: 20,
      marginTop: 13,
      maxWidth: 310,
    },

    // SEARCH

    searchBox: {
      marginHorizontal: 22,
      marginTop: 27,
      height: 54,
      borderRadius: 15,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
    },

    searchIcon: {
      fontSize: 25,
      color: theme.muted,
      marginRight: 10,
    },

    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
    },

    clearText: {
      color: theme.muted,
      fontSize: 18,
      padding: 5,
    },

    // FILTERS

    filterHeading: {
      marginTop: 28,
      marginHorizontal: 22,
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.8,
    },

    filters: {
      paddingHorizontal: 22,
      paddingTop: 13,
      gap: 9,
    },

    filterChip: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 25,
    },

    selectedFilter: {
      backgroundColor: theme.accent,
    },

    filterText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.muted,
    },

    selectedFilterText: {
      color: "#202620",
    },

    // RESULTS HEADER

    resultsHeader: {
      paddingHorizontal: 22,
      marginTop: 34,
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

    resultsSubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    sortText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    // LOADING

    loadingContainer: {
      paddingVertical: 45,
      alignItems: "center",
    },

    loadingText: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 13,
      fontWeight: "700",
    },

    // GYM CARDS

    gymCard: {
      marginHorizontal: 22,
      marginBottom: 19,
      borderRadius: 19,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    cardPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.99 }],
    },

    gymArtwork: {
      height: 165,
      padding: 15,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    },

    gymArtworkImage: {
      opacity: 0.95,
    },

    artworkShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.24)",
    },

    artworkTop: {
      position: "absolute",
      top: 13,
      left: 13,
      right: 13,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    gymTag: {
      color: "#202620",
      backgroundColor: "rgba(255,255,255,0.65)",
      overflow: "hidden",
      borderRadius: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
    },

    artworkNumber: {
      color: "rgba(0,0,0,0.55)",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 2,
    },

    gymEmoji: {
      fontSize: 58,
    },

    artworkBottom: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    artworkBrand: {
      color: "#FFFFFF",
      fontWeight: "900",
      letterSpacing: 2,
      fontSize: 12,
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

    gymDetails: {
      padding: 17,
    },

    gymMainInfo: {
      flex: 1,
    },

    gymNameRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    gymName: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
    },

    arrow: {
      color: theme.accent,
      fontSize: 20,
    },

    gymSuburb: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 5,
    },

    gymFooter: {
      marginTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    categoryBadge: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 7,
    },

    categoryText: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "800",
    },

    viewDetails: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    // EMPTY STATE

    emptyState: {
      marginHorizontal: 22,
      padding: 35,
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },

    emptyEmoji: {
      fontSize: 40,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 12,
    },

    emptySubtitle: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 7,
      textAlign: "center",
    },

    resetButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 17,
      paddingVertical: 11,
      borderRadius: 20,
      marginTop: 17,
    },

    resetButtonText: {
      color: "#202620",
      fontSize: 11,
      fontWeight: "900",
    },

    // ADD GYM

    addGymCard: {
      marginHorizontal: 22,
      marginTop: 10,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 17,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },

    addGymTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },

    addGymSubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 7,
    },

    addGymAction: {
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
