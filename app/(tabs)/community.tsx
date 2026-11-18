import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type FeedFilter = "All" | "Problems" | "Videos";

type ProblemRow = {
  id: string;
  rotation_id: string;
  name: string;
  grade_label: string;
  v_grade: string | null;
  hold_colour: string;
  hold_colour_hex: string | null;
  reference_photo_url: string | null;
  reset_date: string | null;
  created_by: string | null;
  created_at: string;
};

type BetaVideoRow = {
  id: string;
  problem_id: string;
  user_id: string;
  video_path: string;
  caption: string;
  result: string;
  created_at: string;
};

type RotationRow = {
  id: string;
  wall_id: string;
  name: string;
  rotation_number: number;
};

type WallRow = {
  id: string;
  gym_id: string;
  name: string;
};

type GymRow = {
  id: string;
  name: string;
  suburb: string | null;
  city: string;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FeedProblem = ProblemRow & {
  gymName: string;
  wallName: string;
  rotationName: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
};

type FeedVideo = BetaVideoRow & {
  problem: FeedProblem | null;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
};

type FeedItem =
  | { id: string; kind: "problem"; createdAt: string; problem: FeedProblem }
  | { id: string; kind: "video"; createdAt: string; video: FeedVideo };

const PAGE_SIZE = 40;

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return (
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "C"
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const isDark = useColorScheme() !== "light";

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

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedFilter>("All");
  const [search, setSearch] = useState("");
  const [openingVideoId, setOpeningVideoId] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState("");

  const videoPlayer = useVideoPlayer(activeVideoUrl, (player) => {
    player.loop = false;
  });

  useEffect(() => {
    if (activeVideoUrl) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  }, [activeVideoUrl, videoPlayer]);

  const loadCommunity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Both tables have RLS policies that expose approved content only.
      const [problemResult, videoResult] = await Promise.all([
        supabase
          .from("problems")
          .select(
            "id, rotation_id, name, grade_label, v_grade, hold_colour, hold_colour_hex, reference_photo_url, reset_date, created_by, created_at",
          )
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
        supabase
          .from("beta_videos")
          .select(
            "id, problem_id, user_id, video_path, caption, result, created_at",
          )
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE),
      ]);

      if (problemResult.error) throw problemResult.error;
      if (videoResult.error) throw videoResult.error;

      const baseProblems = (problemResult.data ?? []) as ProblemRow[];
      const betaVideos = (videoResult.data ?? []) as BetaVideoRow[];

      // Include approved problems referenced by recent videos even when they
      // fall outside the first page of recently created problems.
      const knownProblemIds = new Set(
        baseProblems.map((problem) => problem.id),
      );
      const missingProblemIds = Array.from(
        new Set(
          betaVideos
            .map((video) => video.problem_id)
            .filter((id) => !knownProblemIds.has(id)),
        ),
      );

      let extraProblems: ProblemRow[] = [];
      if (missingProblemIds.length > 0) {
        const { data, error: extraProblemError } = await supabase
          .from("problems")
          .select(
            "id, rotation_id, name, grade_label, v_grade, hold_colour, hold_colour_hex, reference_photo_url, reset_date, created_by, created_at",
          )
          .in("id", missingProblemIds)
          .eq("status", "approved");
        if (extraProblemError) throw extraProblemError;
        extraProblems = (data ?? []) as ProblemRow[];
      }

      const allProblems = [...baseProblems, ...extraProblems];
      const rotationIds = Array.from(
        new Set(allProblems.map((p) => p.rotation_id)),
      );
      const creatorIds = Array.from(
        new Set([
          ...allProblems
            .map((p) => p.created_by)
            .filter((id): id is string => !!id),
          ...betaVideos.map((video) => video.user_id),
        ]),
      );

      const rotationsResult = rotationIds.length
        ? await supabase
            .from("rotations")
            .select("id, wall_id, name, rotation_number")
            .in("id", rotationIds)
        : { data: [], error: null };
      if (rotationsResult.error) throw rotationsResult.error;
      const rotations = (rotationsResult.data ?? []) as RotationRow[];

      const wallIds = Array.from(
        new Set(rotations.map((rotation) => rotation.wall_id)),
      );
      const wallsResult = wallIds.length
        ? await supabase
            .from("walls")
            .select("id, gym_id, name")
            .in("id", wallIds)
        : { data: [], error: null };
      if (wallsResult.error) throw wallsResult.error;
      const walls = (wallsResult.data ?? []) as WallRow[];

      const gymIds = Array.from(new Set(walls.map((wall) => wall.gym_id)));
      const gymsResult = gymIds.length
        ? await supabase
            .from("gyms")
            .select("id, name, suburb, city")
            .in("id", gymIds)
            .eq("is_active", true)
        : { data: [], error: null };
      if (gymsResult.error) throw gymsResult.error;
      const gyms = (gymsResult.data ?? []) as GymRow[];

      const profilesResult = creatorIds.length
        ? await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", creatorIds)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;
      const profiles = (profilesResult.data ?? []) as ProfileRow[];

      const rotationMap = new Map(rotations.map((row) => [row.id, row]));
      const wallMap = new Map(walls.map((row) => [row.id, row]));
      const gymMap = new Map(gyms.map((row) => [row.id, row]));
      const profileMap = new Map(profiles.map((row) => [row.id, row]));

      const feedProblems: FeedProblem[] = allProblems.map((problem) => {
        const rotation = rotationMap.get(problem.rotation_id);
        const wall = rotation ? wallMap.get(rotation.wall_id) : undefined;
        const gym = wall ? gymMap.get(wall.gym_id) : undefined;
        const profile = problem.created_by
          ? profileMap.get(problem.created_by)
          : undefined;
        const creatorName =
          profile?.display_name || profile?.username || "Community climber";

        return {
          ...problem,
          gymName: gym?.name ?? "Sydney climbing gym",
          wallName: wall?.name ?? "Bouldering wall",
          rotationName:
            rotation?.name ||
            (rotation ? `Rotation ${rotation.rotation_number}` : "Rotation"),
          creatorName,
          creatorUsername: profile?.username ?? "climber",
          creatorAvatar: profile?.avatar_url ?? null,
        };
      });

      const feedProblemMap = new Map(
        feedProblems.map((problem) => [problem.id, problem]),
      );
      const feedVideos: FeedVideo[] = betaVideos.map((video) => {
        const profile = profileMap.get(video.user_id);
        const creatorName =
          profile?.display_name || profile?.username || "Community climber";
        return {
          ...video,
          problem: feedProblemMap.get(video.problem_id) ?? null,
          creatorName,
          creatorUsername: profile?.username ?? "climber",
          creatorAvatar: profile?.avatar_url ?? null,
        };
      });

      const nextItems: FeedItem[] = [
        ...feedProblems.map(
          (problem): FeedItem => ({
            id: `problem-${problem.id}`,
            kind: "problem",
            createdAt: problem.created_at,
            problem,
          }),
        ),
        ...feedVideos
          .filter((video) => video.problem !== null)
          .map(
            (video): FeedItem => ({
              id: `video-${video.id}`,
              kind: "video",
              createdAt: video.created_at,
              video,
            }),
          ),
      ];

      nextItems.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(nextItems);
    } catch (loadError) {
      console.error("Error loading community feed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load community posts. Please try again.",
      );
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "Problems" && item.kind !== "problem") return false;
      if (filter === "Videos" && item.kind !== "video") return false;
      if (!query) return true;

      const searchable =
        item.kind === "problem"
          ? [
              item.problem.name,
              item.problem.grade_label,
              item.problem.v_grade ?? "",
              item.problem.hold_colour,
              item.problem.gymName,
              item.problem.wallName,
              item.problem.creatorName,
              item.problem.creatorUsername,
            ]
          : [
              item.video.caption,
              item.video.problem?.name ?? "",
              item.video.problem?.grade_label ?? "",
              item.video.problem?.gymName ?? "",
              item.video.problem?.wallName ?? "",
              item.video.creatorName,
              item.video.creatorUsername,
            ];
      return searchable.join(" ").toLowerCase().includes(query);
    });
  }, [filter, items, search]);

  async function playVideo(video: FeedVideo) {
    try {
      setOpeningVideoId(video.id);
      const { data, error: signedUrlError } = await supabase.storage
        .from("beta-videos")
        .createSignedUrl(video.video_path, 60 * 60);
      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error("Unable to prepare this video.");

      setActiveVideoTitle(
        video.problem?.name
          ? `${video.problem.name} · ${video.creatorName}`
          : "Community beta",
      );
      setActiveVideoUrl(data.signedUrl);
    } catch (playError) {
      console.error("Unable to open beta video:", playError);
      Alert.alert(
        "Video unavailable",
        playError instanceof Error
          ? playError.message
          : "This beta video could not be opened. Please try again.",
      );
    } finally {
      setOpeningVideoId(null);
    }
  }

  function openProblem(problemId: string) {
    router.push({
      pathname: "/problem/[problemId]",
      params: { problemId },
    });
  }

  function openGyms() {
    router.push("/(tabs)/gyms");
  }

  const filterOptions: FeedFilter[] = ["All", "Problems", "Videos"];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCommunity();
            }}
            tintColor={theme.accent}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SEND SYD.</Text>
            <Text style={styles.eyebrow}>THE SYDNEY CLIMBING COMMUNITY</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/upload")}
            style={styles.headerAction}
            accessibilityRole="button"
            accessibilityLabel="Upload beta video"
          >
            <Ionicons name="add" size={19} color="#191E1C" />
            <Text style={styles.headerActionText}>SHARE BETA</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.heading}>Built by climbers.</Text>
          <Text style={styles.headingAccent}>Shared with the community.</Text>
          <Text style={styles.subtitle}>
            Discover newly documented problems and watch approved beta from
            Sydney climbers.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search problems, gyms or climbers..."
            placeholderTextColor={theme.muted}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filterOptions.map((option) => {
            const selected = filter === option;
            return (
              <Pressable
                key={option}
                onPress={() => setFilter(option)}
                style={[styles.filterChip, selected && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.feedHeader}>
          <View>
            <Text style={styles.sectionTitle}>Community feed</Text>
            <Text style={styles.sectionSubtitle}>
              {loading
                ? "Finding the latest sends..."
                : `${filteredItems.length} ${filteredItems.length === 1 ? "post" : "posts"}`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setLoading(true);
              loadCommunity();
            }}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel="Refresh community feed"
          >
            <Ionicons name="refresh" size={17} color={theme.accent} />
          </Pressable>
        </View>

        {loading && items.length === 0 && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.stateText}>Loading community posts...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={34} color="#FF8B75" />
            <Text style={styles.emptyTitle}>
              Couldn't load the community feed
            </Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={loadCommunity} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={31} color={theme.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {items.length === 0
                ? "Your community starts here"
                : "No matching posts"}
            </Text>
            <Text style={styles.stateText}>
              {items.length === 0
                ? "Approved problems and beta videos will appear here as climbers share their sends. Be one of the first to contribute."
                : "Try another search or switch the feed filter."}
            </Text>
            {items.length === 0 && (
              <Pressable onPress={openGyms} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  EXPLORE SYDNEY GYMS
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.feedList}>
          {filteredItems.map((item) =>
            item.kind === "problem" ? (
              <ProblemPost
                key={item.id}
                problem={item.problem}
                styles={styles}
                onPress={() => openProblem(item.problem.id)}
              />
            ) : (
              <VideoPost
                key={item.id}
                video={item.video}
                styles={styles}
                opening={openingVideoId === item.video.id}
                onPlay={() => playVideo(item.video)}
                onOpenProblem={() => {
                  if (item.video.problem) openProblem(item.video.problem.id);
                }}
              />
            ),
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLogo}>SEND SYD.</Text>
          <Text style={styles.footerText}>
            Built by climbers, for climbers.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!activeVideoUrl}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => setActiveVideoUrl(null)}
      >
        <View style={styles.videoModal}>
          <View style={styles.videoModalHeader}>
            <View style={styles.videoModalTitleWrap}>
              <Text style={styles.videoModalEyebrow}>
                SEND SYD · COMMUNITY BETA
              </Text>
              <Text style={styles.videoModalTitle} numberOfLines={1}>
                {activeVideoTitle}
              </Text>
            </View>
            <Pressable
              onPress={() => setActiveVideoUrl(null)}
              style={styles.modalClose}
              accessibilityRole="button"
              accessibilityLabel="Close video"
            >
              <Ionicons name="close" size={22} color="#F4F3ED" />
            </Pressable>
          </View>
          {activeVideoUrl ? (
            <VideoView
              player={videoPlayer}
              style={styles.fullVideo}
              nativeControls
              contentFit="contain"
              allowsFullscreen
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function Avatar({
  uri,
  name,
  styles,
}: {
  uri: string | null;
  name: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.avatar}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

function ProblemPost({
  problem,
  styles,
  onPress,
}: {
  problem: FeedProblem;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.postCard, pressed && styles.cardPressed]}
    >
      <View style={styles.postTopline}>
        <Avatar
          uri={problem.creatorAvatar}
          name={problem.creatorName}
          styles={styles}
        />
        <View style={styles.creatorDetails}>
          <Text style={styles.creatorName}>{problem.creatorName}</Text>
          <Text style={styles.creatorHandle}>
            @{problem.creatorUsername} · ADDED A PROBLEM
          </Text>
        </View>
        <Text style={styles.postDate}>{formatDate(problem.created_at)}</Text>
      </View>

      {problem.reference_photo_url ? (
        <Image
          source={{ uri: problem.reference_photo_url }}
          style={styles.problemImage}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.problemImagePlaceholder,
            { backgroundColor: problem.hold_colour_hex || "#303A33" },
          ]}
        >
          <Ionicons
            name="fitness-outline"
            size={55}
            color="rgba(17,21,18,0.72)"
          />
          <Text style={styles.imagePlaceholderLabel}>NEW PROBLEM</Text>
        </View>
      )}

      <View style={styles.postBody}>
        <View style={styles.postTitleRow}>
          <View style={styles.postTitleWrap}>
            <Text style={styles.postTitle}>{problem.name}</Text>
            <Text style={styles.postLocation}>
              {problem.gymName} · {problem.wallName}
            </Text>
          </View>
          <View style={styles.gradePill}>
            <Text style={styles.gradePillText}>{problem.grade_label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.holdMeta}>
            <View
              style={[
                styles.holdDot,
                { backgroundColor: problem.hold_colour_hex || "#89938B" },
              ]}
            />
            <Text style={styles.metaText}>{problem.hold_colour} holds</Text>
          </View>
          {problem.reset_date && (
            <Text style={styles.metaText}>
              Set {formatDate(problem.reset_date)}
            </Text>
          )}
        </View>

        <View style={styles.postActionRow}>
          <Text style={styles.viewProblemText}>VIEW PROBLEM</Text>
          <Ionicons name="arrow-forward" size={16} color="#D7E65A" />
        </View>
      </View>
    </Pressable>
  );
}

function VideoPost({
  video,
  styles,
  opening,
  onPlay,
  onOpenProblem,
}: {
  video: FeedVideo;
  styles: ReturnType<typeof createStyles>;
  opening: boolean;
  onPlay: () => void;
  onOpenProblem: () => void;
}) {
  const problem = video.problem;
  return (
    <View style={styles.postCard}>
      <View style={styles.postTopline}>
        <Avatar
          uri={video.creatorAvatar}
          name={video.creatorName}
          styles={styles}
        />
        <View style={styles.creatorDetails}>
          <Text style={styles.creatorName}>{video.creatorName}</Text>
          <Text style={styles.creatorHandle}>
            @{video.creatorUsername} · SHARED BETA
          </Text>
        </View>
        <Text style={styles.postDate}>{formatDate(video.created_at)}</Text>
      </View>

      <Pressable
        onPress={onPlay}
        style={styles.videoArtwork}
        accessibilityRole="button"
        accessibilityLabel="Play community beta video"
      >
        {problem?.reference_photo_url ? (
          <ImageBackground
            source={{ uri: problem.reference_photo_url }}
            style={styles.videoArtworkImage}
            resizeMode="cover"
          >
            <View style={styles.videoShade} />
          </ImageBackground>
        ) : (
          <View
            style={[
              styles.videoArtworkImage,
              { backgroundColor: problem?.hold_colour_hex || "#303A33" },
            ]}
          >
            <Ionicons
              name="videocam-outline"
              size={54}
              color="rgba(17,21,18,0.62)"
            />
          </View>
        )}
        <View style={styles.playCircle}>
          {opening ? (
            <ActivityIndicator color="#191E1C" />
          ) : (
            <Ionicons
              name="play"
              size={25}
              color="#191E1C"
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
        <View style={styles.videoArtworkBottom}>
          <Text style={styles.videoArtworkTitle}>WATCH COMMUNITY BETA</Text>
          <Text style={styles.videoArtworkDuration}>APPROVED</Text>
        </View>
      </Pressable>

      <View style={styles.postBody}>
        <Text style={styles.videoCaption}>
          {video.caption || "Shared a send with the community."}
        </Text>
        <View style={styles.postTitleRow}>
          <View style={styles.postTitleWrap}>
            <Text style={styles.postTitle}>
              {problem?.name ?? "Boulder problem"}
            </Text>
            <Text style={styles.postLocation}>
              {problem?.gymName ?? "Sydney gym"} ·{" "}
              {problem?.wallName ?? "Bouldering wall"}
            </Text>
          </View>
          {problem?.grade_label ? (
            <View style={styles.gradePill}>
              <Text style={styles.gradePillText}>{problem.grade_label}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.postActionRow}>
          <Pressable onPress={onPlay} style={styles.inlineAction}>
            <Ionicons name="play-circle-outline" size={18} color="#D7E65A" />
            <Text style={styles.viewProblemText}>WATCH BETA</Text>
          </Pressable>
          <Pressable onPress={onOpenProblem} style={styles.inlineAction}>
            <Text style={styles.viewProblemText}>VIEW PROBLEM</Text>
            <Ionicons name="arrow-forward" size={16} color="#D7E65A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

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
    container: { flex: 1, backgroundColor: theme.background },
    content: { paddingTop: 58, paddingBottom: 110 },
    header: {
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logo: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      letterSpacing: -1,
    },
    eyebrow: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.6,
      marginTop: 5,
    },
    headerAction: {
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.accent,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    headerActionText: {
      color: "#191E1C",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    intro: { paddingHorizontal: 22, marginTop: 34 },
    heading: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -1,
    },
    headingAccent: {
      color: theme.accent,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.7,
      marginTop: 3,
    },
    subtitle: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 12,
      maxWidth: 320,
    },
    searchBox: {
      marginHorizontal: 22,
      marginTop: 24,
      height: 51,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      gap: 10,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 12 },
    filters: {
      paddingHorizontal: 22,
      paddingTop: 17,
      paddingBottom: 5,
      gap: 8,
    },
    filterChip: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 17,
      paddingVertical: 10,
      borderRadius: 22,
    },
    filterChipActive: { backgroundColor: theme.accent },
    filterText: { color: theme.muted, fontSize: 11, fontWeight: "800" },
    filterTextActive: { color: "#191E1C" },
    feedHeader: {
      paddingHorizontal: 22,
      marginTop: 28,
      marginBottom: 15,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    sectionSubtitle: { color: theme.muted, fontSize: 10, marginTop: 5 },
    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingState: { paddingVertical: 55, alignItems: "center", gap: 13 },
    stateCard: {
      marginHorizontal: 22,
      marginTop: 8,
      padding: 26,
      borderRadius: 17,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    emptyIcon: {
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 12,
    },
    stateText: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 8,
    },
    primaryButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 10,
      marginTop: 18,
    },
    primaryButtonText: {
      color: "#191E1C",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    feedList: { paddingHorizontal: 22, gap: 15, marginTop: 4 },
    postCard: {
      backgroundColor: theme.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    cardPressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
    postTopline: {
      paddingHorizontal: 14,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 37,
      height: 37,
      borderRadius: 19,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarInitials: { color: "#191E1C", fontSize: 12, fontWeight: "900" },
    creatorDetails: { flex: 1, gap: 3 },
    creatorName: { color: theme.text, fontSize: 11, fontWeight: "900" },
    creatorHandle: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    postDate: { color: theme.muted, fontSize: 8, fontWeight: "700" },
    problemImage: {
      width: "100%",
      height: 190,
      backgroundColor: theme.surfaceAlt,
    },
    problemImagePlaceholder: {
      width: "100%",
      height: 165,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    imagePlaceholderLabel: {
      color: "rgba(17,21,18,0.72)",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 2,
    },
    postBody: { padding: 15 },
    postTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    postTitleWrap: { flex: 1, gap: 5 },
    postTitle: { color: theme.text, fontSize: 15, fontWeight: "900" },
    postLocation: { color: theme.muted, fontSize: 10, lineHeight: 15 },
    gradePill: {
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
    },
    gradePillText: { color: theme.text, fontSize: 10, fontWeight: "900" },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      gap: 8,
    },
    holdMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    holdDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.3)",
    },
    metaText: { color: theme.muted, fontSize: 9, fontWeight: "700" },
    postActionRow: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 14,
      paddingTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    viewProblemText: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    videoArtwork: {
      height: 205,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    },
    videoArtworkImage: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    videoShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    playCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    videoArtworkBottom: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 13,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    videoArtworkTitle: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.1,
      textShadowColor: "rgba(0,0,0,0.7)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    videoArtworkDuration: {
      color: "#191E1C",
      backgroundColor: theme.accent,
      fontSize: 8,
      fontWeight: "900",
      overflow: "hidden",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    videoCaption: {
      color: theme.text,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 13,
    },
    inlineAction: { flexDirection: "row", alignItems: "center", gap: 5 },
    footer: { alignItems: "center", paddingTop: 35 },
    footerLogo: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 2,
    },
    footerText: { color: theme.muted, fontSize: 10, marginTop: 7 },
    videoModal: {
      flex: 1,
      backgroundColor: "#080A08",
      justifyContent: "center",
    },
    videoModalHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      paddingTop: 58,
      paddingHorizontal: 20,
      paddingBottom: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: "rgba(8,10,8,0.95)",
    },
    videoModalTitleWrap: { flex: 1, gap: 5 },
    videoModalEyebrow: {
      color: "#D7E65A",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.4,
    },
    videoModalTitle: { color: "#F4F3ED", fontSize: 14, fontWeight: "900" },
    modalClose: {
      width: 39,
      height: 39,
      borderRadius: 12,
      backgroundColor: "#292F2C",
      alignItems: "center",
      justifyContent: "center",
    },
    fullVideo: { width: "100%", height: "70%", backgroundColor: "#000000" },
  });
}
