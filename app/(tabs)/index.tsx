import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

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
// DEMONSTRATION VIDEO DATA
// ----------------------------------------

const videos = [
  {
    username: "alex.climbs",
    gym: "9 Degrees Alexandria",
    grade: "V5",
    colour: "#D7E65A",
    title: "Finally sent this one!",
    emoji: "🟢",
  },
  {
    username: "sydney.beta",
    gym: "Nomad",
    grade: "V7",
    colour: "#CB83E8",
    title: "Working on this overhang",
    emoji: "🟣",
  },
];

// ----------------------------------------
// HOME SCREEN
// ----------------------------------------

export default function HomeScreen() {
  const router = useRouter();

  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // Supabase gym data
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [gymError, setGymError] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Selected filter
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
    accent: "#D7E65A",
  };

  const styles = createStyles(theme);

  // ----------------------------------------
  // FETCH GYMS FROM SUPABASE
  // ----------------------------------------

  async function fetchGyms() {
    setLoadingGyms(true);
    setGymError(null);

    try {
      const data = await getGyms();
      setGyms(data);
    } catch (error) {
      console.error("Error fetching gyms:", error);

      setGymError("Unable to load gyms. Please try again.");
      setGyms([]);
    } finally {
      setLoadingGyms(false);
    }
  }

  // Fetch gyms when the screen opens
  useEffect(() => {
    fetchGyms();
  }, []);

  // ----------------------------------------
  // OPEN GYM PAGE
  // ----------------------------------------

  function openGym(gymId: string) {
    router.push({
      pathname: "/gym/[gymId]",
      params: {
        gymId,
      },
    });
  }

  // ----------------------------------------
  // FILTER GYMS
  // ----------------------------------------

  const filteredGyms = gyms.filter((gym) => {
    const searchText = [gym.name, gym.suburb ?? "", gym.city, gym.state]
      .join(" ")
      .toLowerCase();

    return searchText.includes(search.toLowerCase());
  });

  // ----------------------------------------
  // FILTER BUTTONS
  // ----------------------------------------

  const filters = ["All", "Gyms", "Problems", "Videos", "Community"];

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              SEND<Text style={styles.logoAccent}> SYD</Text>
            </Text>

            <Text style={styles.tagline}>FIND YOUR NEXT SEND.</Text>
          </View>

          <Pressable
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText}>S</Text>
          </Pressable>
        </View>

        {/* GREETING */}

        <View style={styles.greeting}>
          <Text style={styles.eyebrow}>YOUR CLIMBING COMMUNITY</Text>

          <Text style={styles.heading}>Ready to{"\n"}send something?</Text>

          <Text style={styles.subtitle}>
            Discover problems. Share beta. Send harder.
          </Text>
        </View>

        {/* SEARCH */}

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            placeholder="Search gyms"
            placeholderTextColor={theme.muted}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}

          <Text style={styles.filterIcon}>☷</Text>
        </View>

        {/* QUICK FILTERS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((item) => {
            const selected = activeFilter === item;

            return (
              <Pressable
                key={item}
                onPress={() => setActiveFilter(item)}
                style={[styles.filter, selected && styles.activeFilter]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.activeFilterText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FEATURED GYMS */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Explore gyms</Text>

            <Text style={styles.sectionSubtitle}>
              Find your next climbing destination
            </Text>
          </View>

          <Pressable onPress={() => router.push("/(tabs)/gyms")}>
            <Text style={styles.seeAll}>See all ↗</Text>
          </Pressable>
        </View>

        {/* LOADING */}

        {loadingGyms && (
          <ActivityIndicator
            size="large"
            color={theme.accent}
            style={styles.loading}
          />
        )}

        {/* ERROR */}

        {!loadingGyms && gymError && (
          <Pressable onPress={fetchGyms} style={styles.errorContainer}>
            <Text style={styles.errorText}>{gymError}</Text>

            <Text style={styles.seeAll}>Tap to retry ↗</Text>
          </Pressable>
        )}

        {/* EMPTY STATE */}

        {!loadingGyms && !gymError && filteredGyms.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No gyms found</Text>

            <Text style={styles.emptyText}>Try another search.</Text>
          </View>
        )}

        {/* SUPABASE GYM CARDS */}

        {!loadingGyms && !gymError && filteredGyms.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gymList}
          >
            {filteredGyms.map((gym, index) => {
              const gymColours = [
                "#D7E65A",
                "#FF8B75",
                "#7B9BFF",
                "#CB83E8",
                "#58C99A",
              ];

              const gymColour = gymColours[index % gymColours.length];

              return (
                <Pressable
                  key={gym.id}
                  style={styles.gymCard}
                  onPress={() => openGym(gym.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${gym.name}`}
                >
                  {/* GYM ARTWORK */}

                  <ImageBackground
                    source={{ uri: gym.image_url || TEMP_GYM_COVER }}
                    resizeMode="cover"
                    style={[
                      styles.gymArtwork,
                      {
                        backgroundColor: gymColour,
                      },
                    ]}
                    imageStyle={styles.gymArtworkImage}
                  >
                    <View style={styles.gymArtworkShade} />

                    <Text style={styles.gymEmoji}>🧗</Text>

                    <View style={styles.gymBadge}>
                      <Text style={styles.gymBadgeText}>
                        {gym.city.toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.gymArtworkBottom}>
                      <Text style={styles.artworkText}>CLIMB.</Text>
                      {!gym.image_url && (
                        <Text style={styles.temporaryPhotoLabel}>
                          TEMP PHOTO
                        </Text>
                      )}
                    </View>
                  </ImageBackground>

                  {/* GYM DETAILS */}

                  <View style={styles.gymInfo}>
                    <Text style={styles.gymName}>{gym.name}</Text>

                    <Text style={styles.gymLocation}>
                      {gym.suburb
                        ? `${gym.suburb}, ${gym.city}`
                        : `${gym.city}, ${gym.state}`}
                    </Text>

                    <Text style={styles.gymProblems}>Explore gym ↗</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* COMMUNITY BETA */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Latest beta</Text>

            <Text style={styles.sectionSubtitle}>
              See how the community sends
            </Text>
          </View>

          <Pressable onPress={() => router.push("/(tabs)/community")}>
            <Text style={styles.seeAll}>See all ↗</Text>
          </Pressable>
        </View>

        {/* VIDEO CARDS */}

        {videos.map((video) => (
          <Pressable key={video.username} style={styles.videoCard}>
            <View
              style={[styles.videoArtwork, { backgroundColor: video.colour }]}
            >
              <Text style={styles.videoEmoji}>{video.emoji}</Text>

              <View style={styles.gradeBadge}>
                <Text style={styles.gradeText}>{video.grade}</Text>
              </View>

              <View style={styles.playButton}>
                <Text style={styles.playText}>▶</Text>
              </View>

              <Text style={styles.videoArtworkLabel}>SEND SYD</Text>
            </View>

            <View style={styles.videoInfo}>
              <View style={styles.videoDetails}>
                <Text style={styles.videoTitle}>{video.title}</Text>

                <Text style={styles.videoGym}>{video.gym}</Text>

                <Text style={styles.videoUser}>@{video.username}</Text>
              </View>

              <Text style={styles.moreIcon}>•••</Text>
            </View>
          </Pressable>
        ))}

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

    scrollContent: {
      paddingTop: 58,
      paddingBottom: 110,
    },

    // HEADER

    header: {
      paddingHorizontal: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    logo: {
      fontSize: 27,
      fontWeight: "900",
      letterSpacing: -1.5,
      color: theme.text,
    },

    logoAccent: {
      color: theme.accent,
    },

    tagline: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 2,
      color: theme.muted,
      marginTop: 3,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      color: "#202620",
      fontSize: 18,
      fontWeight: "900",
    },

    // GREETING

    greeting: {
      paddingHorizontal: 22,
      marginTop: 36,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
      color: "#A6B65A",
      marginBottom: 12,
    },

    heading: {
      color: theme.text,
      fontSize: 39,
      fontWeight: "900",
      lineHeight: 43,
      letterSpacing: -1.5,
    },

    subtitle: {
      color: theme.muted,
      fontSize: 13,
      marginTop: 12,
    },

    // SEARCH

    searchContainer: {
      marginHorizontal: 22,
      marginTop: 27,
      height: 53,
      borderRadius: 15,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
    },

    searchIcon: {
      fontSize: 26,
      color: theme.muted,
      marginRight: 10,
    },

    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 12,
    },

    clearSearch: {
      color: theme.muted,
      fontSize: 16,
      paddingHorizontal: 8,
    },

    filterIcon: {
      fontSize: 23,
      color: theme.muted,
    },

    // FILTERS

    filters: {
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 8,
      gap: 9,
    },

    filter: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 30,
      paddingHorizontal: 17,
      paddingVertical: 10,
    },

    activeFilter: {
      backgroundColor: theme.accent,
    },

    filterText: {
      color: theme.muted,
      fontSize: 11,
      fontWeight: "700",
    },

    activeFilterText: {
      color: "#202620",
    },

    // SECTION HEADERS

    sectionHeader: {
      marginTop: 30,
      marginBottom: 16,
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    sectionTitle: {
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: -0.5,
      color: theme.text,
    },

    sectionSubtitle: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    seeAll: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "800",
    },

    loading: {
      marginVertical: 35,
    },

    errorContainer: {
      paddingHorizontal: 22,
      paddingVertical: 25,
    },

    errorText: {
      color: theme.text,
      marginBottom: 10,
    },

    emptyContainer: {
      paddingHorizontal: 22,
      paddingVertical: 25,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
    },

    emptyText: {
      color: theme.muted,
      marginTop: 6,
    },

    // GYM CARDS

    gymList: {
      paddingHorizontal: 22,
      gap: 13,
    },

    gymCard: {
      width: 220,
      borderRadius: 17,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    gymArtwork: {
      height: 135,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },

    gymArtworkImage: {
      opacity: 0.96,
    },

    gymArtworkShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.25)",
    },

    gymEmoji: {
      fontSize: 48,
    },

    gymBadge: {
      position: "absolute",
      top: 12,
      left: 12,
      backgroundColor: "rgba(0,0,0,0.7)",
      borderRadius: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    gymBadgeText: {
      fontSize: 8,
      color: "#FFFFFF",
      fontWeight: "900",
      letterSpacing: 1,
    },

    gymArtworkBottom: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    artworkText: {
      fontSize: 19,
      fontWeight: "900",
      color: "#FFFFFF",
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
      paddingHorizontal: 6,
      paddingVertical: 4,
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.6,
    },

    gymInfo: {
      padding: 14,
    },

    gymName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
    },

    gymLocation: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    gymProblems: {
      color: "#A6B65A",
      fontSize: 10,
      fontWeight: "800",
      marginTop: 10,
    },

    // VIDEO CARDS

    videoCard: {
      marginHorizontal: 22,
      marginBottom: 16,
      borderRadius: 17,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    videoArtwork: {
      height: 185,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },

    videoEmoji: {
      fontSize: 65,
    },

    gradeBadge: {
      position: "absolute",
      top: 13,
      left: 13,
      backgroundColor: "#171B18",
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 7,
    },

    gradeText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 12,
    },

    playButton: {
      position: "absolute",
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },

    playText: {
      color: "#FFFFFF",
      fontSize: 16,
      marginLeft: 3,
    },

    videoArtworkLabel: {
      position: "absolute",
      right: 13,
      bottom: 12,
      color: "rgba(0,0,0,0.4)",
      fontWeight: "900",
      fontSize: 12,
      letterSpacing: 2,
    },

    videoInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 15,
    },

    videoDetails: {
      flex: 1,
    },

    videoTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 13,
    },

    videoGym: {
      color: theme.muted,
      fontSize: 11,
      marginTop: 5,
    },

    videoUser: {
      color: "#A6B65A",
      fontSize: 10,
      marginTop: 7,
      fontWeight: "700",
    },

    moreIcon: {
      color: theme.muted,
      fontSize: 19,
      paddingHorizontal: 5,
    },

    // FOOTER

    footer: {
      alignItems: "center",
      paddingTop: 28,
      paddingBottom: 15,
    },

    footerLogo: {
      color: theme.text,
      fontSize: 17,
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
