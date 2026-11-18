import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "../../lib/supabase";

type ProblemSummary = {
  id: string;
  name: string;
  grade_label: string;
  hold_colour: string;
  hold_colour_hex: string | null;
  status: "pending" | "approved" | "rejected";
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export default function ProblemBetaUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    problemId?: string | string[];
  }>();
  const rawProblemId = params.problemId;
  const problemId = Array.isArray(rawProblemId)
    ? rawProblemId[0]
    : rawProblemId;

  const [problem, setProblem] = useState<ProblemSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const player = useVideoPlayer(video?.uri ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  useEffect(() => {
    let isMounted = true;

    async function loadScreen() {
      setLoading(true);
      try {
        const [sessionResult, problemResult] = await Promise.all([
          supabase.auth.getSession(),
          problemId
            ? supabase
                .from("problems")
                .select(
                  "id, name, grade_label, hold_colour, hold_colour_hex, status",
                )
                .eq("id", problemId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (sessionResult.error) throw sessionResult.error;
        if (!isMounted) return;

        setSignedIn(!!sessionResult.data.session?.user);

        if (!problemId) {
          throw new Error(
            "No problem was selected. Return to a problem page and try again.",
          );
        }
        if (problemResult.error) throw problemResult.error;
        if (!problemResult.data || problemResult.data.status !== "approved") {
          throw new Error(
            "This problem is not available for beta submissions. Only approved problems can receive videos.",
          );
        }

        setProblem(problemResult.data as ProblemSummary);
      } catch (error) {
        console.error("Unable to load problem for beta upload:", error);
        if (isMounted) {
          Alert.alert(
            "Unable to open beta upload",
            error instanceof Error
              ? error.message
              : "Please return to the problem and try again.",
            [{ text: "Go back", onPress: () => router.back() }],
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadScreen();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setSignedIn(!!session?.user);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [problemId, router]);

  async function selectVideo() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo library access needed",
          "Allow SEND SYD to access your videos so you can choose your climbing beta.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const selectedVideo = result.assets[0];
      if (selectedVideo.fileSize && selectedVideo.fileSize > MAX_VIDEO_SIZE) {
        Alert.alert(
          "Video too large",
          "Please choose a video smaller than 50 MB.",
        );
        return;
      }

      setVideo(selectedVideo);
    } catch (error) {
      console.error("Video selection error:", error);
      Alert.alert(
        "Unable to select video",
        "Please try opening your photo library again.",
      );
    }
  }

  function getVideoExtension(asset: ImagePicker.ImagePickerAsset) {
    const fileName = asset.fileName ?? "";
    const extension = fileName.split(".").pop()?.toLowerCase();

    if (
      extension &&
      extension !== fileName.toLowerCase() &&
      ["mp4", "mov", "webm", "m4v"].includes(extension)
    ) {
      return extension;
    }

    switch (asset.mimeType) {
      case "video/quicktime":
        return "mov";
      case "video/webm":
        return "webm";
      case "video/x-m4v":
        return "m4v";
      default:
        return "mp4";
    }
  }

  function getVideoMimeType(asset: ImagePicker.ImagePickerAsset) {
    if (asset.mimeType) return asset.mimeType;

    switch (getVideoExtension(asset)) {
      case "mov":
        return "video/quicktime";
      case "webm":
        return "video/webm";
      case "m4v":
        return "video/x-m4v";
      default:
        return "video/mp4";
    }
  }

  async function submitBeta() {
    if (!problem || problem.status !== "approved") {
      Alert.alert(
        "Problem unavailable",
        "Only approved problems can receive beta videos.",
      );
      return;
    }
    if (!signedIn) {
      Alert.alert(
        "Sign in required",
        "Sign in or create an account before submitting beta videos.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: () => router.push("/auth") },
        ],
      );
      return;
    }
    if (!video) {
      Alert.alert("Video required", "Please select a climbing video first.");
      return;
    }
    if (!caption.trim()) {
      Alert.alert(
        "Caption required",
        "Please add a short caption about your climb.",
      );
      return;
    }
    if (video.fileSize && video.fileSize > MAX_VIDEO_SIZE) {
      Alert.alert(
        "Video too large",
        "Please choose a video smaller than 50 MB.",
      );
      return;
    }

    setUploading(true);
    let videoPath: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user)
        throw new Error("Your session has expired. Please sign in again.");

      const extension = getVideoExtension(video);
      const contentType = getVideoMimeType(video);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
      videoPath = `${user.id}/${problem.id}/${fileName}`;

      // Keep the same local-file upload approach as the existing beta upload tab.
      const fileResponse = await fetch(video.uri);
      const videoBlob = await fileResponse.blob();
      if (!videoBlob || videoBlob.size === 0) {
        throw new Error(
          "The selected video could not be read from your device.",
        );
      }
      if (videoBlob.size > MAX_VIDEO_SIZE) {
        throw new Error("The selected video exceeds the 50 MB limit.");
      }

      const { error: storageError } = await supabase.storage
        .from("beta-videos")
        .upload(videoPath, videoBlob, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (storageError) throw storageError;

      const { error: insertError } = await supabase.from("beta_videos").insert({
        problem_id: problem.id,
        user_id: user.id,
        video_path: videoPath,
        caption: caption.trim(),
        result: "SEND",
        status: "pending",
      });

      if (insertError) {
        await supabase.storage.from("beta-videos").remove([videoPath]);
        videoPath = null;
        throw insertError;
      }

      Alert.alert(
        "Beta submitted!",
        "Your video has been uploaded and sent for moderation. It will appear on this problem once approved.",
        [{ text: "Back to problem", onPress: () => router.back() }],
      );
    } catch (error) {
      console.error("Problem beta upload error:", error);
      Alert.alert(
        "Upload unsuccessful",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );

      if (videoPath) {
        const { error: cleanupError } = await supabase.storage
          .from("beta-videos")
          .remove([videoPath]);
        if (cleanupError)
          console.error("Could not clean up uploaded video:", cleanupError);
      }
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#D7E65A" />
        <Text style={styles.helperText}>Loading problem...</Text>
      </View>
    );
  }

  if (!problem) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorTitle}>Problem unavailable</Text>
        <Text style={styles.helperText}>
          Return to the problem page and try again.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK TO PROBLEM</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SEND SYD · COMMUNITY</Text>
        <Text style={styles.title}>Share your beta.</Text>
        <Text style={styles.subtitle}>
          Add your send video to this problem. Your submission will be reviewed
          before it appears publicly.
        </Text>

        <View style={styles.problemCard}>
          <View
            style={[
              styles.problemColour,
              { backgroundColor: problem.hold_colour_hex || "#D7E65A" },
            ]}
          />
          <View style={styles.problemInfo}>
            <Text style={styles.problemEyebrow}>SUBMITTING BETA FOR</Text>
            <Text style={styles.problemName}>{problem.name}</Text>
            <Text style={styles.problemMeta}>
              {problem.grade_label} · {problem.hold_colour}
            </Text>
          </View>
          <Text style={styles.lockIcon}>✓</Text>
        </View>

        {!signedIn && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Sign in required</Text>
            <Text style={styles.helperText}>
              You can browse SEND SYD without an account, but you need to sign
              in to submit beta.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push("/auth")}
            >
              <Text style={styles.secondaryButtonText}>
                SIGN IN / CREATE ACCOUNT →
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>01 · Your climbing video</Text>
        {video ? (
          <View style={styles.previewContainer}>
            <VideoView
              player={player}
              style={styles.videoPreview}
              nativeControls
              contentFit="contain"
            />
            <View style={styles.videoDetails}>
              <Text style={styles.videoName} numberOfLines={1}>
                {video.fileName || "Selected climbing video"}
              </Text>
              <Text style={styles.videoDuration}>
                {video.duration
                  ? `${Math.round(video.duration / 1000)} seconds`
                  : "Video selected"}
              </Text>
            </View>
            <Pressable onPress={selectVideo} style={styles.changeVideo}>
              <Text style={styles.changeVideoText}>CHANGE VIDEO</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={selectVideo} style={styles.videoPicker}>
            <View style={styles.uploadIcon}>
              <Text style={styles.plus}>+</Text>
            </View>
            <Text style={styles.pickerTitle}>Select a climbing video</Text>
            <Text style={styles.pickerSubtitle}>
              Choose a video from your phone gallery
            </Text>
            <View style={styles.selectButton}>
              <Text style={styles.selectButtonText}>CHOOSE VIDEO ↗</Text>
            </View>
          </Pressable>
        )}
        <Text style={styles.uploadLimit}>Maximum video size: 50 MB</Text>

        <Text style={styles.sectionTitle}>02 · Add a caption</Text>
        <TextInput
          style={styles.captionInput}
          placeholder="Tell us about your send..."
          placeholderTextColor="#778078"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.characterCount}>
          {caption.length}/300 characters
        </Text>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Community moderation</Text>
          <Text style={styles.helperText}>
            Your video will be marked as pending and checked by a moderator. It
            will only appear on the problem page after approval.
          </Text>
        </View>

        <Pressable
          onPress={submitBeta}
          disabled={uploading || !signedIn}
          style={[
            styles.submitButton,
            (uploading || !signedIn) && styles.disabledButton,
          ]}
        >
          {uploading ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color="#202620" />
              <Text style={styles.submitButtonText}>UPLOADING...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT BETA ↗</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          SEND SYD · BUILT BY CLIMBERS, FOR CLIMBERS.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111512" },
  center: {
    flex: 1,
    backgroundColor: "#111512",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  content: { paddingHorizontal: 22, paddingTop: 58, paddingBottom: 45 },
  backButton: { paddingVertical: 12, marginBottom: 18 },
  backText: {
    color: "#D7E65A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  eyebrow: {
    color: "#D7E65A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: { color: "#F4F3ED", fontSize: 34, fontWeight: "900", marginTop: 12 },
  subtitle: {
    color: "#9AA49C",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 26,
  },
  problemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D2420",
    borderWidth: 1,
    borderColor: "#3B4934",
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 25,
    minHeight: 94,
  },
  problemColour: { width: 8, alignSelf: "stretch" },
  problemInfo: { flex: 1, paddingHorizontal: 15, paddingVertical: 14 },
  problemEyebrow: {
    color: "#9AA49C",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  problemName: {
    color: "#F4F3ED",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 6,
  },
  problemMeta: {
    color: "#D7E65A",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
  },
  lockIcon: {
    color: "#D7E65A",
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 16,
  },
  warningCard: {
    backgroundColor: "#252D28",
    borderWidth: 1,
    borderColor: "#FFB84D",
    borderRadius: 13,
    padding: 15,
    marginBottom: 20,
    gap: 9,
  },
  warningTitle: { color: "#F4F3ED", fontSize: 13, fontWeight: "900" },
  sectionTitle: {
    color: "#F4F3ED",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 28,
    marginBottom: 15,
  },
  helperText: { color: "#9AA49C", fontSize: 11, lineHeight: 18 },
  secondaryButton: {
    backgroundColor: "#D7E65A",
    borderRadius: 9,
    padding: 13,
    alignItems: "center",
    marginTop: 5,
  },
  secondaryButtonText: {
    color: "#202620",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  videoPicker: {
    height: 225,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#526044",
    backgroundColor: "#1D2420",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#D7E65A",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { color: "#202620", fontSize: 30, fontWeight: "500", marginTop: -3 },
  pickerTitle: {
    color: "#F4F3ED",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 15,
  },
  pickerSubtitle: { color: "#9AA49C", fontSize: 11, marginTop: 7 },
  selectButton: {
    backgroundColor: "#D7E65A",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 9,
    marginTop: 17,
  },
  selectButtonText: {
    color: "#202620",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1D2420",
    borderWidth: 1,
    borderColor: "#303A33",
  },
  videoPreview: { width: "100%", height: 230, backgroundColor: "#080A08" },
  videoDetails: { padding: 14 },
  videoName: { color: "#F4F3ED", fontWeight: "800", fontSize: 13 },
  videoDuration: { color: "#9AA49C", fontSize: 10, marginTop: 5 },
  changeVideo: { padding: 13, borderTopWidth: 1, borderTopColor: "#303A33" },
  changeVideoText: {
    color: "#D7E65A",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
  uploadLimit: { color: "#778078", fontSize: 10, marginTop: 9 },
  captionInput: {
    minHeight: 115,
    backgroundColor: "#1D2420",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#303A33",
    padding: 15,
    color: "#F4F3ED",
    fontSize: 13,
  },
  characterCount: {
    color: "#778078",
    fontSize: 10,
    textAlign: "right",
    marginTop: 7,
  },
  noticeCard: {
    marginTop: 25,
    padding: 17,
    borderRadius: 14,
    backgroundColor: "#252D28",
    gap: 8,
    marginBottom: 18,
  },
  noticeTitle: {
    color: "#D7E65A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  submitButton: {
    marginTop: 15,
    backgroundColor: "#D7E65A",
    borderRadius: 12,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  disabledButton: { opacity: 0.45 },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitButtonText: {
    color: "#202620",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  disclaimer: {
    color: "#778078",
    fontSize: 9,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 25,
  },
  primaryButton: {
    backgroundColor: "#D7E65A",
    borderRadius: 11,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 15,
  },
  primaryButtonText: {
    color: "#191E1C",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
