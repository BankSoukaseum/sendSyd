import { useCallback, useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";

const KOFI_URL = "https://ko-fi.com/banksoukaseum";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [activeSection, setActiveSection] = useState<"activity" | "saved">(
    "activity",
  );

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
  // LOAD PROFILE AND MODERATION PERMISSIONS
  // ========================================

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setSignedIn(false);
        setIsModerator(false);
        setProfile(null);
        setUsername("");
        setDisplayName("");
        setBio("");
        setInstagramUrl("");
        setTiktokUrl("");
        setWebsiteUrl("");
        return;
      }

      setSignedIn(true);

      const user = session.user;

      // Check whether the user has moderation permissions.
      const { data: roleData, error: roleError } = await supabase.rpc(
        "has_moderation_role",
        {
          allowed_roles: ["owner", "admin", "moderator"],
        },
      );

      if (roleError) {
        console.error("Unable to check moderation role:", roleError);
        setIsModerator(false);
      } else {
        setIsModerator(roleData === true);
      }

      // Load profile information.
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, bio, instagram_url, tiktok_url, website_url",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setUsername(data.username);
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setInstagramUrl(data.instagram_url ?? "");
        setTiktokUrl(data.tiktok_url ?? "");
        setWebsiteUrl(data.website_url ?? "");
      } else {
        const defaultUsername =
          user.email?.split("@")[0] ?? `climber_${user.id.slice(0, 8)}`;

        setUsername(defaultUsername);
        setDisplayName("");
        setBio("");
        setInstagramUrl("");
        setTiktokUrl("");
        setWebsiteUrl("");
        setProfile(null);
      }
    } catch (error) {
      console.error("Error loading profile:", error);

      Alert.alert(
        "Unable to load profile",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ========================================
  // PROFILE PICTURE
  // ========================================

  const changeProfilePicture = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow SEND SYD to access your photo library so you can choose a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const image = result.assets[0];

      if (image.fileSize && image.fileSize > 5 * 1024 * 1024) {
        Alert.alert(
          "Image too large",
          "Please choose an image smaller than 5 MB.",
        );
        return;
      }

      setUploadingAvatar(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      // React Native uploads should use an ArrayBuffer rather than Blob/File.
      const response = await fetch(image.uri);

      if (!response.ok) {
        throw new Error("The selected image could not be read.");
      }

      const imageBuffer = await response.arrayBuffer();

      if (!imageBuffer || imageBuffer.byteLength === 0) {
        throw new Error("The selected image is empty or could not be read.");
      }

      if (imageBuffer.byteLength > 5 * 1024 * 1024) {
        throw new Error("Please choose an image smaller than 5 MB.");
      }

      const mimeType = image.mimeType ?? "image/jpeg";
      const extension =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : "jpg";

      const avatarPath = `${user.id}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(avatarPath, imageBuffer, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(avatarPath);

      // A version query prevents the device cache from showing the previous photo.
      const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const currentUsername =
        profile?.username ?? username.trim().toLowerCase();

      const safeUsername = /^[a-z0-9_]{3,20}$/.test(currentUsername)
        ? currentUsername
        : `climber_${user.id.slice(0, 8)}`;

      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: safeUsername,
            display_name: profile?.display_name ?? (displayName.trim() || null),
            bio: profile?.bio ?? (bio.trim() || null),
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select(
          "id, username, display_name, avatar_url, bio, instagram_url, tiktok_url, website_url",
        )
        .single();

      if (profileError) throw profileError;

      setProfile(updatedProfile);
      setUsername(updatedProfile.username);
      setDisplayName(updatedProfile.display_name ?? "");
      setBio(updatedProfile.bio ?? "");

      // Remove a previous avatar from this user's folder when the extension changed.
      const previousAvatarPath = profile?.avatar_url
        ?.split("/storage/v1/object/public/profile-avatars/")[1]
        ?.split("?")[0];

      if (
        previousAvatarPath &&
        previousAvatarPath !== avatarPath &&
        previousAvatarPath.startsWith(`${user.id}/`)
      ) {
        await supabase.storage
          .from("profile-avatars")
          .remove([decodeURIComponent(previousAvatarPath)]);
      }

      Alert.alert(
        "Profile picture updated",
        "Your new picture is now visible on your profile.",
      );
    } catch (error) {
      console.error("Profile picture upload error:", error);

      Alert.alert(
        "Unable to update picture",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ========================================
  // PROFILE EDITING AND SOCIAL LINKS
  // ========================================

  const openEditor = () => {
    setUsername(profile?.username ?? username);
    setDisplayName(profile?.display_name ?? displayName);
    setBio(profile?.bio ?? bio);
    setInstagramUrl(profile?.instagram_url ?? instagramUrl);
    setTiktokUrl(profile?.tiktok_url ?? tiktokUrl);
    setWebsiteUrl(profile?.website_url ?? websiteUrl);
    setEditVisible(true);
  };

  const normalizeSocialUrl = (
    value: string,
    platform: "instagram" | "tiktok" | "website",
  ): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const profileHost =
      platform === "instagram"
        ? "www.instagram.com"
        : platform === "tiktok"
          ? "www.tiktok.com"
          : null;

    // Accept a simple @handle for Instagram and TikTok.
    if (
      platform !== "website" &&
      !/^https?:\/\//i.test(trimmed) &&
      !trimmed.includes("/")
    ) {
      const handle = trimmed.replace(/^@/, "");
      if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) {
        throw new Error(
          `Enter a valid ${platform === "instagram" ? "Instagram" : "TikTok"} username or profile URL.`,
        );
      }
      return `https://${profileHost}/${handle}/`;
    }

    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(
        `Enter a valid ${platform === "website" ? "website" : platform} URL.`,
      );
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Links must use HTTPS or HTTP.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("Please enter a link without embedded login details.");
    }

    if (
      platform === "instagram" &&
      parsed.hostname !== "instagram.com" &&
      !parsed.hostname.endsWith(".instagram.com")
    ) {
      throw new Error("Please enter an Instagram profile link or username.");
    }
    if (
      platform === "tiktok" &&
      parsed.hostname !== "tiktok.com" &&
      !parsed.hostname.endsWith(".tiktok.com")
    ) {
      throw new Error("Please enter a TikTok profile link or username.");
    }

    return parsed.toString();
  };

  const openSocialLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Unable to open social link:", error);
      Alert.alert(
        "Unable to open link",
        "Please check the link and try again.",
      );
    }
  };

  const saveProfile = async () => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanBio = bio.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      Alert.alert(
        "Invalid username",
        "Use 3–20 characters containing only letters, numbers or underscores.",
      );
      return;
    }

    let cleanInstagramUrl: string | null;
    let cleanTiktokUrl: string | null;
    let cleanWebsiteUrl: string | null;
    try {
      cleanInstagramUrl = normalizeSocialUrl(instagramUrl, "instagram");
      cleanTiktokUrl = normalizeSocialUrl(tiktokUrl, "tiktok");
      cleanWebsiteUrl = normalizeSocialUrl(websiteUrl, "website");
    } catch (error) {
      Alert.alert(
        "Check your social links",
        error instanceof Error
          ? error.message
          : "Please check the entered links.",
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in again.");

      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            username: cleanUsername,
            display_name: cleanDisplayName || null,
            bio: cleanBio || null,
            instagram_url: cleanInstagramUrl,
            tiktok_url: cleanTiktokUrl,
            website_url: cleanWebsiteUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select(
          "id, username, display_name, avatar_url, bio, instagram_url, tiktok_url, website_url",
        )
        .single();

      if (error) throw error;

      setProfile(data);
      setInstagramUrl(data.instagram_url ?? "");
      setTiktokUrl(data.tiktok_url ?? "");
      setWebsiteUrl(data.website_url ?? "");
      setEditVisible(false);

      Alert.alert("Profile updated", "Your changes have been saved.");
    } catch (error) {
      console.error("Error saving profile:", error);

      const message =
        error instanceof Error ? error.message : "Please try again.";

      Alert.alert(
        "Unable to save profile",
        message.includes("profiles_username_key")
          ? "That username is already taken. Please choose another."
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // SIGN OUT
  // ========================================

  const openKoFi = async () => {
    try {
      await Linking.openURL(KOFI_URL);
    } catch (error) {
      console.error("Unable to open Ko-fi:", error);
      Alert.alert(
        "Unable to open Ko-fi",
        "Please try again or visit ko-fi.com/banksoukaseum in your browser.",
      );
    }
  };

  const signOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out of SEND SYD?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.auth.signOut();

          if (error) {
            Alert.alert("Sign out failed", error.message);
            return;
          }

          setProfile(null);
          setSignedIn(false);
          setIsModerator(false);
        },
      },
    ]);
  };

  // ========================================
  // PROFILE DISPLAY
  // ========================================

  const displayTitle = profile?.display_name || "Climber";

  const initials = displayTitle
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // ========================================
  // SIGNED-OUT SCREEN
  // ========================================

  if (!signedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.signedOutContent}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarEmoji}>🧗</Text>
          </View>

          <Text style={styles.logo}>SEND SYD.</Text>

          <Text style={styles.signedOutTitle}>Your climbing profile.</Text>

          <Text style={styles.subtitle}>
            Sign in to share beta, save your favourite climbs and track your
            climbing activity.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryButtonText}>
              SIGN IN / CREATE ACCOUNT →
            </Text>
          </Pressable>

          <Text style={styles.smallText}>
            You can still browse SEND SYD without an account.
          </Text>
        </View>
      </View>
    );
  }

  // ========================================
  // MAIN PROFILE SCREEN
  // ========================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProfile();
            }}
            tintColor={theme.accent}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.logo}>SEND SYD.</Text>

          <Pressable onPress={openEditor} style={styles.settingsButton}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        {/* PROFILE */}

        <View style={styles.profileSection}>
          <Pressable
            onPress={changeProfilePicture}
            disabled={uploadingAvatar}
            style={styles.avatarPressable}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <View style={styles.avatar}>
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarInitials}>{initials || "S"}</Text>
              )}

              {uploadingAvatar && (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#191E1C" />
                </View>
              )}
            </View>

            <Text style={styles.avatarHint}>
              {uploadingAvatar ? "UPLOADING..." : "TAP TO CHANGE PHOTO"}
            </Text>
          </Pressable>

          <Text style={styles.name}>{displayTitle}</Text>

          <Text style={styles.username}>@{profile?.username ?? username}</Text>

          <Text style={styles.bio}>
            {profile?.bio || "Out there chasing the next send."}
          </Text>

          {(profile?.instagram_url ||
            profile?.tiktok_url ||
            profile?.website_url) && (
            <View style={styles.socialLinks}>
              {profile.instagram_url && (
                <Pressable
                  style={styles.socialLink}
                  onPress={() => openSocialLink(profile.instagram_url!)}
                >
                  <Text style={styles.socialLinkText}>INSTAGRAM ↗</Text>
                </Pressable>
              )}
              {profile.tiktok_url && (
                <Pressable
                  style={styles.socialLink}
                  onPress={() => openSocialLink(profile.tiktok_url!)}
                >
                  <Text style={styles.socialLinkText}>TIKTOK ↗</Text>
                </Pressable>
              )}
              {profile.website_url && (
                <Pressable
                  style={styles.socialLink}
                  onPress={() => openSocialLink(profile.website_url!)}
                >
                  <Text style={styles.socialLinkText}>WEBSITE ↗</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable style={styles.editButton} onPress={openEditor}>
            <Text style={styles.editButtonText}>EDIT PROFILE</Text>
          </Pressable>
        </View>

        {/* STATS */}

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>SENDS</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>BETA VIDEOS</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statNumber}>—</Text>
            <Text style={styles.statLabel}>SAVED</Text>
          </View>
        </View>

        {/* ACTIVITY AND SAVED BETA */}

        <View style={styles.section}>
          <View style={styles.sectionTabs}>
            <Pressable
              onPress={() => setActiveSection("activity")}
              style={[
                styles.sectionTab,
                activeSection === "activity" && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  activeSection === "activity" && styles.activeTabText,
                ]}
              >
                ACTIVITY
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveSection("saved")}
              style={[
                styles.sectionTab,
                activeSection === "saved" && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  activeSection === "saved" && styles.activeTabText,
                ]}
              >
                SAVED BETA
              </Text>
            </Pressable>
          </View>

          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>
              {activeSection === "activity" ? "🧗" : "🔖"}
            </Text>

            <Text style={styles.emptyTitle}>
              {activeSection === "activity"
                ? "Your journey starts here"
                : "No saved beta yet"}
            </Text>

            <Text style={styles.emptySubtitle}>
              {activeSection === "activity"
                ? "Your climbing activity and uploaded videos will appear here."
                : "Save your favourite beta videos and find them here later."}
            </Text>
          </View>
        </View>

        {/* ACCOUNT */}

        <View style={styles.accountSection}>
          <Text style={styles.accountHeading}>ACCOUNT</Text>

          <Pressable style={styles.accountRow} onPress={openEditor}>
            <Text style={styles.accountRowText}>Edit profile</Text>
            <Text style={styles.rowArrow}>›</Text>
          </Pressable>

          {/* MODERATION DASHBOARD - AUTHORISED USERS ONLY */}

          {isModerator && (
            <Pressable
              style={styles.adminRow}
              onPress={() => router.push("/admin")}
            >
              <View style={styles.adminRowLeft}>
                <View style={styles.adminIcon}>
                  <Text style={styles.adminIconText}>⚙</Text>
                </View>

                <View style={styles.adminTextContainer}>
                  <Text style={styles.adminRowText}>Admin Dashboard</Text>

                  <Text style={styles.adminDescription}>
                    Review community submissions
                  </Text>
                </View>
              </View>

              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          )}

          <Pressable style={styles.accountRow} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
            <Text style={styles.rowArrow}>›</Text>
          </Pressable>
        </View>

        {/* SUPPORT SEND SYD */}

        <View style={styles.supportCard}>
          <View style={styles.supportCopy}>
            <Text style={styles.supportEyebrow}>LOVE THE COMMUNITY?</Text>
            <Text style={styles.supportTitle}>Support SEND SYD.</Text>
            <Text style={styles.supportDescription}>
              Help keep the project growing and support more features for Sydney
              climbers.
            </Text>
          </View>

          <Pressable
            style={styles.supportButton}
            onPress={openKoFi}
            accessibilityRole="button"
            accessibilityLabel="Support SEND SYD on Ko-fi"
          >
            <Text style={styles.supportButtonText}>SUPPORT ON KO-FI ↗</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>SEND SYD · BUILT BY CLIMBERS</Text>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}

      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit profile</Text>

                <Pressable onPress={() => setEditVisible(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>USERNAME</Text>

              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="your_username"
                placeholderTextColor={theme.muted}
                maxLength={20}
              />

              <Text style={styles.inputLabel}>DISPLAY NAME</Text>

              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={theme.muted}
                maxLength={40}
              />

              <Text style={styles.inputLabel}>BIO</Text>

              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about your climbing..."
                placeholderTextColor={theme.muted}
                multiline
                maxLength={160}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>INSTAGRAM</Text>
              <TextInput
                style={styles.input}
                value={instagramUrl}
                onChangeText={setInstagramUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="@username or instagram.com/username"
                placeholderTextColor={theme.muted}
                maxLength={200}
              />

              <Text style={styles.inputLabel}>TIKTOK</Text>
              <TextInput
                style={styles.input}
                value={tiktokUrl}
                onChangeText={setTiktokUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="@username or tiktok.com/@username"
                placeholderTextColor={theme.muted}
                maxLength={200}
              />

              <Text style={styles.inputLabel}>WEBSITE</Text>
              <TextInput
                style={styles.input}
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="yourwebsite.com"
                placeholderTextColor={theme.muted}
                maxLength={250}
              />

              <Text style={styles.socialHelper}>
                Social links are optional. Enter a username or a full profile
                link.
              </Text>

              <Pressable
                style={[styles.primaryButton, saving && styles.disabledButton]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#191E1C" />
                ) : (
                  <Text style={styles.primaryButtonText}>SAVE CHANGES</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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

    loadingContainer: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },

    loadingText: {
      color: theme.muted,
      fontSize: 12,
    },

    header: {
      paddingHorizontal: 22,
      paddingTop: 60,
      paddingBottom: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    logo: {
      color: theme.accent,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 2,
    },

    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    settingsIcon: {
      color: theme.text,
      fontSize: 21,
    },

    profileSection: {
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 28,
    },

    avatarPressable: {
      alignItems: "center",
      marginBottom: 17,
    },

    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      overflow: "hidden",
      backgroundColor: "#D7E65A",
      alignItems: "center",
      justifyContent: "center",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 50,
    },

    avatarLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(215,230,90,0.78)",
      alignItems: "center",
      justifyContent: "center",
    },

    avatarHint: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 8,
    },

    avatarInitials: {
      color: "#191E1C",
      fontSize: 35,
      fontWeight: "900",
    },

    avatarPlaceholder: {
      width: 95,
      height: 95,
      borderRadius: 30,
      backgroundColor: "#D7E65A",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },

    avatarEmoji: {
      fontSize: 48,
    },

    name: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
    },

    username: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 5,
    },

    bio: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 13,
      maxWidth: 280,
    },

    socialLinks: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      maxWidth: 320,
    },

    socialLink: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingHorizontal: 13,
      paddingVertical: 8,
      backgroundColor: theme.surface,
    },

    socialLinkText: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    editButton: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 28,
      paddingVertical: 11,
      borderRadius: 9,
      marginTop: 18,
    },

    editButtonText: {
      color: theme.text,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    statsContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      marginHorizontal: 20,
      paddingVertical: 23,
      backgroundColor: theme.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },

    stat: {
      flex: 1,
      alignItems: "center",
    },

    statNumber: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },

    statLabel: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.8,
      marginTop: 6,
    },

    statDivider: {
      width: 1,
      height: 35,
      backgroundColor: theme.border,
    },

    section: {
      marginTop: 32,
      paddingHorizontal: 20,
    },

    sectionTabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    sectionTab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 15,
    },

    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.accent,
    },

    sectionTabText: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },

    activeTabText: {
      color: theme.accent,
    },

    emptyState: {
      alignItems: "center",
      paddingHorizontal: 25,
      paddingVertical: 42,
    },

    emptyEmoji: {
      fontSize: 32,
      marginBottom: 14,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },

    emptySubtitle: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 8,
      maxWidth: 260,
    },

    accountSection: {
      marginHorizontal: 20,
      marginTop: 10,
      padding: 18,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    accountHeading: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginBottom: 8,
    },

    accountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    accountRowText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "600",
    },

    adminRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    adminRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    adminIcon: {
      width: 37,
      height: 37,
      borderRadius: 11,
      backgroundColor: "#D7E65A22",
      alignItems: "center",
      justifyContent: "center",
    },

    adminIconText: {
      color: theme.accent,
      fontSize: 19,
    },

    adminTextContainer: {
      gap: 4,
    },

    adminRowText: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "900",
    },

    adminDescription: {
      color: theme.muted,
      fontSize: 9,
    },

    signOutText: {
      color: "#FF6B5F",
      fontSize: 12,
      fontWeight: "700",
    },

    rowArrow: {
      color: theme.muted,
      fontSize: 23,
    },

    supportCard: {
      marginHorizontal: 20,
      marginTop: 18,
      padding: 18,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },

    supportCopy: {
      marginBottom: 16,
    },

    supportEyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.3,
      marginBottom: 7,
    },

    supportTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
    },

    supportDescription: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
    },

    supportButton: {
      minHeight: 46,
      borderRadius: 10,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },

    supportButtonText: {
      color: "#191E1C",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    footer: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 35,
      marginBottom: 30,
    },

    signedOutContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 35,
    },

    signedOutTitle: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
      marginTop: 30,
      textAlign: "center",
    },

    subtitle: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 25,
    },

    smallText: {
      color: theme.muted,
      fontSize: 10,
      textAlign: "center",
      marginTop: 18,
    },

    primaryButton: {
      backgroundColor: "#D7E65A",
      borderRadius: 11,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      marginTop: 12,
    },

    primaryButtonText: {
      color: "#191E1C",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "flex-end",
    },

    modalScroll: {
      width: "100%",
      maxHeight: "92%",
    },

    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 35,
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 25,
    },

    modalTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },

    closeButton: {
      color: theme.muted,
      fontSize: 22,
      padding: 5,
    },

    inputLabel: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
      marginBottom: 9,
    },

    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      color: theme.text,
      padding: 14,
      fontSize: 13,
      marginBottom: 20,
    },

    bioInput: {
      height: 95,
    },

    socialHelper: {
      color: theme.muted,
      fontSize: 10,
      lineHeight: 15,
      marginTop: -8,
      marginBottom: 12,
    },

    disabledButton: {
      opacity: 0.5,
    },
  });
}
