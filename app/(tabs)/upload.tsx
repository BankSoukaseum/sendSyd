import * as ImagePicker from "expo-image-picker";
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
import { getGyms, type Gym } from "../../lib/gymService";
import { supabase } from "../../lib/supabase";
import { getWallsByGymId, type Wall } from "../../lib/wallService";

type ProblemOption = {
  id: string;
  rotation_id: string;
  name: string;
  grade_label: string;
  hold_colour: string;
  hold_colour_hex: string | null;
  reference_photo_url: string | null;
  rotationLabel: string;
  isCurrentRotation: boolean;
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export default function UploadScreen() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [problems, setProblems] = useState<ProblemOption[]>([]);

  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [selectedWall, setSelectedWall] = useState<Wall | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemOption | null>(
    null,
  );

  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [caption, setCaption] = useState("");

  const [loadingGyms, setLoadingGyms] = useState(true);
  const [loadingWalls, setLoadingWalls] = useState(false);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [uploading, setUploading] = useState(false);

  const result = "SEND" as const;

  const player = useVideoPlayer(video?.uri ?? null, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    loadGyms();
  }, []);

  async function loadGyms() {
    try {
      setLoadingGyms(true);

      const data = await getGyms();
      setGyms(data);
    } catch (error) {
      console.error("Error loading gyms:", error);

      Alert.alert("Unable to load gyms", "Please try again.");
    } finally {
      setLoadingGyms(false);
    }
  }

  async function loadWalls(gymId: string) {
    try {
      setLoadingWalls(true);
      setWalls([]);

      const data = await getWallsByGymId(gymId);
      setWalls(data);
    } catch (error) {
      console.error("Error loading walls:", error);

      Alert.alert("Unable to load walls", "Please try again.");
    } finally {
      setLoadingWalls(false);
    }
  }

  async function loadProblems(wallId: string) {
    try {
      setLoadingProblems(true);
      setProblems([]);

      const { data: rotations, error: rotationError } = await supabase
        .from("rotations")
        .select("id, rotation_number, name, is_active")
        .eq("wall_id", wallId)
        .order("rotation_number", { ascending: false });

      if (rotationError) throw rotationError;

      if (!rotations || rotations.length === 0) {
        setProblems([]);
        return;
      }

      const rotationIds = rotations.map((rotation) => rotation.id);

      const { data: problemData, error: problemError } = await supabase
        .from("problems")
        .select(
          "id, rotation_id, name, grade_label, hold_colour, hold_colour_hex, reference_photo_url",
        )
        .in("rotation_id", rotationIds)
        .eq("status", "approved")
        .order("name", { ascending: true });

      if (problemError) throw problemError;

      const rotationMap = new Map(
        rotations.map((rotation) => [
          rotation.id,
          {
            label: rotation.name || `Rotation ${rotation.rotation_number}`,
            isCurrent: rotation.is_active,
          },
        ]),
      );

      const formattedProblems: ProblemOption[] = (problemData ?? []).map(
        (problem) => {
          const rotation = rotationMap.get(problem.rotation_id);

          return {
            ...problem,
            rotationLabel: rotation?.label ?? "Previous rotation",
            isCurrentRotation: rotation?.isCurrent ?? false,
          };
        },
      );

      formattedProblems.sort((a, b) => {
        if (a.isCurrentRotation !== b.isCurrentRotation) {
          return a.isCurrentRotation ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      });

      setProblems(formattedProblems);
    } catch (error) {
      console.error("Error loading approved problems:", error);

      Alert.alert(
        "Unable to load problems",
        "Please try selecting the wall again.",
      );
    } finally {
      setLoadingProblems(false);
    }
  }

  function changeGym(gym: Gym) {
    setSelectedGym(gym);
    setSelectedWall(null);
    setSelectedProblem(null);

    setWalls([]);
    setProblems([]);

    loadWalls(gym.id);
  }

  function changeWall(wall: Wall) {
    setSelectedWall(wall);
    setSelectedProblem(null);
    setProblems([]);

    loadProblems(wall.id);
  }

  async function selectVideo() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow SEND SYD to access your photo library.",
        );

        return;
      }

      const selected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      if (!selected.canceled && selected.assets.length > 0) {
        const selectedVideo = selected.assets[0];

        if (selectedVideo.fileSize && selectedVideo.fileSize > MAX_VIDEO_SIZE) {
          Alert.alert(
            "Video too large",
            "Please choose a video smaller than 50 MB.",
          );

          return;
        }

        setVideo(selectedVideo);
      }
    } catch (error) {
      console.error("Video selection error:", error);

      Alert.alert("Error", "Unable to open your video library.");
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

    const extension = getVideoExtension(asset);

    switch (extension) {
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

  async function submitUpload() {
    if (!selectedGym) {
      Alert.alert("Select a gym", "Please choose the gym where you climbed.");

      return;
    }

    if (!selectedWall) {
      Alert.alert("Select a wall", "Please choose the climbing wall.");

      return;
    }

    if (!selectedProblem) {
      Alert.alert(
        "Select a problem",
        "Please select an approved problem before uploading your beta.",
      );

      return;
    }

    if (!video) {
      Alert.alert("Video required", "Please select a climbing video first.");

      return;
    }

    if (!caption.trim()) {
      Alert.alert("Caption required", "Please add a caption to your video.");

      return;
    }

    if (video.fileSize && video.fileSize > MAX_VIDEO_SIZE) {
      Alert.alert(
        "Video too large",
        "Please choose a video smaller than 50 MB.",
      );

      return;
    }

    try {
      setUploading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert(
          "Sign in required",
          "Please sign in before uploading a beta video.",
        );

        return;
      }

      const extension = getVideoExtension(video);
      const mimeType = getVideoMimeType(video);

      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${extension}`;

      const videoPath = `${user.id}/${selectedProblem.id}/${fileName}`;

      const response = await fetch(video.uri);
      const videoBlob = await response.blob();

      if (!videoBlob || videoBlob.size === 0) {
        throw new Error("The selected video could not be read.");
      }

      if (videoBlob.size > MAX_VIDEO_SIZE) {
        throw new Error("The selected video exceeds the 50 MB limit.");
      }

      const { error: storageError } = await supabase.storage
        .from("beta-videos")
        .upload(videoPath, videoBlob, {
          contentType: mimeType,
          upsert: false,
        });

      if (storageError) throw storageError;

      const { error: insertError } = await supabase.from("beta_videos").insert({
        problem_id: selectedProblem.id,
        user_id: user.id,
        video_path: videoPath,
        caption: caption.trim(),
        result: "SEND",
        status: "pending",
      });

      if (insertError) {
        await supabase.storage.from("beta-videos").remove([videoPath]);

        throw insertError;
      }

      Alert.alert(
        "Beta submitted!",
        "Your video has been uploaded and sent for moderation. It will appear on the problem page once approved.",
        [
          {
            text: "OK",
            onPress: () => {
              setVideo(null);
              setCaption("");
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Beta upload error:", error);

      Alert.alert(
        "Upload unsuccessful",
        error?.message ??
          "Something went wrong while uploading your beta video. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  function renderChip(label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>SEND SYD · COMMUNITY</Text>

        <Text style={styles.title}>Share your beta.</Text>

        <Text style={styles.subtitle}>
          Find the problem you climbed, upload your video and share your beta
          with the community.
        </Text>

        {/* 01 - GYM */}
        <Text style={styles.sectionTitle}>01 · Where did you climb?</Text>

        <Text style={styles.fieldLabel}>SELECT GYM / BRANCH</Text>

        {loadingGyms ? (
          <ActivityIndicator color="#D7E65A" style={styles.loader} />
        ) : gyms.length === 0 ? (
          <Text style={styles.emptyText}>No gyms are currently available.</Text>
        ) : (
          <View style={styles.chipContainer}>
            {gyms.map((gym) =>
              renderChip(gym.name, selectedGym?.id === gym.id, () =>
                changeGym(gym),
              ),
            )}
          </View>
        )}

        {/* 02 - WALL */}
        <Text style={styles.sectionTitle}>02 · Select your wall</Text>

        {!selectedGym ? (
          <Text style={styles.helperText}>
            Choose a gym first to see its walls.
          </Text>
        ) : loadingWalls ? (
          <ActivityIndicator color="#D7E65A" style={styles.loader} />
        ) : walls.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No walls added yet</Text>

            <Text style={styles.emptyText}>
              Wall layouts for {selectedGym.name} have not been configured yet.
              Check back once the gym's walls have been added.
            </Text>
          </View>
        ) : (
          <View style={styles.chipContainer}>
            {walls.map((wall) =>
              renderChip(wall.name, selectedWall?.id === wall.id, () =>
                changeWall(wall),
              ),
            )}
          </View>
        )}

        {/* 03 - PROBLEM */}
        <Text style={styles.sectionTitle}>03 · Find your problem</Text>

        {!selectedWall ? (
          <Text style={styles.helperText}>
            Choose a wall to see its approved problems.
          </Text>
        ) : loadingProblems ? (
          <ActivityIndicator color="#D7E65A" style={styles.loader} />
        ) : problems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No approved problems yet</Text>

            <Text style={styles.emptyText}>
              There are currently no approved problems recorded for this wall.
              Beta videos can only be uploaded to an existing approved problem.
            </Text>
          </View>
        ) : (
          <View style={styles.problemList}>
            {problems.map((problem) => {
              const active = selectedProblem?.id === problem.id;

              return (
                <Pressable
                  key={problem.id}
                  onPress={() => setSelectedProblem(problem)}
                  style={[
                    styles.problemCard,
                    active && styles.problemCardActive,
                  ]}
                >
                  <View style={styles.problemTopRow}>
                    <View
                      style={[
                        styles.colourDot,
                        {
                          backgroundColor: problem.hold_colour_hex || "#D7E65A",
                        },
                      ]}
                    />

                    <View style={styles.problemInfo}>
                      <Text
                        style={[
                          styles.problemName,
                          active && styles.selectedText,
                        ]}
                      >
                        {problem.name}
                      </Text>

                      <Text
                        style={[
                          styles.problemDetails,
                          active && styles.selectedSubText,
                        ]}
                      >
                        {problem.grade_label} · {problem.hold_colour}
                      </Text>
                    </View>

                    {active && <Text style={styles.selectedTick}>✓</Text>}
                  </View>

                  <View style={styles.rotationRow}>
                    <Text
                      style={[
                        styles.rotationText,
                        active && styles.selectedSubText,
                      ]}
                    >
                      {problem.rotationLabel}
                    </Text>

                    {problem.isCurrentRotation && (
                      <Text style={styles.currentBadge}>CURRENT</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* 04 - VIDEO */}
        <Text style={styles.sectionTitle}>04 · Your video</Text>

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
          <Pressable
            onPress={selectVideo}
            style={({ pressed }) => [
              styles.videoPicker,
              pressed && { opacity: 0.75 },
            ]}
          >
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

        {/* 05 - RESULT */}
        <Text style={styles.sectionTitle}>05 · Your result</Text>

        <View style={styles.resultContainer}>
          <View style={[styles.resultOption, styles.resultSelected]}>
            <Text style={[styles.resultTitle, styles.selectedText]}>
              ✓ SEND
            </Text>

            <Text style={[styles.resultSubtitle, styles.selectedText]}>
              I completed it
            </Text>
          </View>
        </View>

        {/* 06 - CAPTION */}
        <Text style={styles.sectionTitle}>06 · Add a caption</Text>

        <TextInput
          style={styles.captionInput}
          placeholder="Tell us about your climb..."
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

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>YOUR BETA SUBMISSION</Text>

          <Text style={styles.summaryText}>
            Gym: {selectedGym?.name ?? "Not selected"}
          </Text>

          <Text style={styles.summaryText}>
            Wall: {selectedWall?.name ?? "Not selected"}
          </Text>

          <Text style={styles.summaryText}>
            Problem: {selectedProblem?.name ?? "Not selected"}
          </Text>

          <Text style={styles.summaryText}>
            Grade: {selectedProblem?.grade_label ?? "—"}
          </Text>

          <Text style={styles.summaryText}>Result: {result}</Text>

          <Text style={styles.summaryText}>
            Video: {video?.fileName || (video ? "Selected" : "Not selected")}
          </Text>
        </View>

        {/* SUBMIT */}
        <Pressable
          onPress={submitUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.submitButton,
            pressed &&
              !uploading && {
                opacity: 0.75,
              },
            uploading && styles.submitDisabled,
          ]}
        >
          {uploading ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color="#202620" />

              <Text style={styles.submitText}>UPLOADING...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>SUBMIT BETA ↗</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          Your beta video will be submitted for moderation before appearing
          publicly on the selected problem page.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.logo}>SEND SYD.</Text>

          <Text style={styles.footerText}>
            Built by climbers, for climbers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111512",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 65,
    paddingBottom: 45,
  },
  eyebrow: {
    color: "#D7E65A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: "#F4F3ED",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 12,
  },
  subtitle: {
    color: "#9AA49C",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 30,
  },
  sectionTitle: {
    color: "#F4F3ED",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 30,
    marginBottom: 15,
  },
  fieldLabel: {
    color: "#9AA49C",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 10,
  },
  loader: {
    marginVertical: 20,
  },
  helperText: {
    color: "#778078",
    fontSize: 12,
    lineHeight: 19,
  },
  emptyText: {
    color: "#9AA49C",
    fontSize: 12,
    lineHeight: 19,
  },
  emptyCard: {
    backgroundColor: "#1D2420",
    borderWidth: 1,
    borderColor: "#303A33",
    borderRadius: 13,
    padding: 16,
  },
  emptyTitle: {
    color: "#F4F3ED",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  chip: {
    backgroundColor: "#1D2420",
    borderWidth: 1,
    borderColor: "#303A33",
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: "#D7E65A",
    borderColor: "#D7E65A",
  },
  chipText: {
    color: "#B5BDB6",
    fontSize: 11,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#202620",
  },
  problemList: {
    gap: 10,
  },
  problemCard: {
    backgroundColor: "#1D2420",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#303A33",
    padding: 15,
  },
  problemCardActive: {
    backgroundColor: "#303A27",
    borderColor: "#D7E65A",
  },
  problemTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colourDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#FFFFFF44",
    marginRight: 12,
  },
  problemInfo: {
    flex: 1,
  },
  problemName: {
    color: "#F4F3ED",
    fontSize: 13,
    fontWeight: "900",
  },
  problemDetails: {
    color: "#9AA49C",
    fontSize: 11,
    marginTop: 5,
  },
  selectedText: {
    color: "#D7E65A",
  },
  selectedSubText: {
    color: "#D1D6D0",
  },
  selectedTick: {
    color: "#D7E65A",
    fontSize: 19,
    fontWeight: "900",
    marginLeft: 10,
  },
  rotationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#303A33",
  },
  rotationText: {
    color: "#778078",
    fontSize: 10,
  },
  currentBadge: {
    color: "#D7E65A",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  videoPicker: {
    height: 230,
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
  plus: {
    color: "#202620",
    fontSize: 30,
    fontWeight: "500",
    marginTop: -3,
  },
  pickerTitle: {
    color: "#F4F3ED",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 15,
  },
  pickerSubtitle: {
    color: "#9AA49C",
    fontSize: 11,
    marginTop: 7,
  },
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
  videoPreview: {
    width: "100%",
    height: 230,
    backgroundColor: "#080A08",
  },
  videoDetails: {
    padding: 14,
  },
  videoName: {
    color: "#F4F3ED",
    fontWeight: "800",
    fontSize: 13,
  },
  videoDuration: {
    color: "#9AA49C",
    fontSize: 10,
    marginTop: 5,
  },
  changeVideo: {
    padding: 13,
    borderTopWidth: 1,
    borderTopColor: "#303A33",
  },
  changeVideoText: {
    color: "#D7E65A",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
  uploadLimit: {
    color: "#778078",
    fontSize: 10,
    marginTop: 9,
  },
  resultContainer: {
    flexDirection: "row",
    gap: 12,
  },
  resultOption: {
    flex: 1,
    backgroundColor: "#1D2420",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#303A33",
    padding: 16,
  },
  resultSelected: {
    backgroundColor: "#D7E65A",
    borderColor: "#D7E65A",
  },
  resultTitle: {
    color: "#F4F3ED",
    fontSize: 13,
    fontWeight: "900",
  },
  resultSubtitle: {
    color: "#9AA49C",
    fontSize: 10,
    marginTop: 7,
  },
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
  summaryCard: {
    marginTop: 25,
    padding: 17,
    borderRadius: 14,
    backgroundColor: "#252D28",
    gap: 9,
  },
  summaryTitle: {
    color: "#D7E65A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  summaryText: {
    color: "#D1D6D0",
    fontSize: 12,
  },
  submitButton: {
    marginTop: 22,
    backgroundColor: "#D7E65A",
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: "center",
  },
  submitDisabled: {
    opacity: 0.6,
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  submitText: {
    color: "#202620",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  disclaimer: {
    color: "#778078",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 14,
  },
  footer: {
    alignItems: "center",
    marginTop: 45,
  },
  logo: {
    color: "#F4F3ED",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
  footerText: {
    color: "#9AA49C",
    fontSize: 10,
    marginTop: 7,
  },
});
