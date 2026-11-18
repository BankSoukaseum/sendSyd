import { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useColorScheme,
} from "react-native";

import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";

type Problem = {
  id: string;
  name: string;
  grade_label: string;
  v_grade: string | null;
  hold_colour: string;
  hold_colour_hex: string | null;
  wall_angle: string | null;
  description: string | null;
  reference_photo_url: string | null;
  start_description: string | null;
  finish_description: string | null;
  created_by: string | null;
  created_at: string;
};

export default function AdminScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const [loading, setLoading] = useState(true);
  const [authorised, setAuthorised] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const theme = {
    background: isDark ? "#111512" : "#F5F4EF",
    surface: isDark ? "#1D2420" : "#FFFFFF",
    text: isDark ? "#F4F3ED" : "#202620",
    muted: isDark ? "#9AA49C" : "#777E76",
    border: isDark ? "#303A33" : "#E3E2DA",
    accent: "#D7E65A",
  };

  const styles = createStyles(theme);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setAuthorised(false);
        setProblems([]);
        return;
      }

      const { data: roleData, error: roleError } = await supabase.rpc(
        "has_moderation_role",
        {
          allowed_roles: ["owner", "admin", "moderator"],
        },
      );

      if (roleError) throw roleError;

      if (roleData !== true) {
        setAuthorised(false);
        setProblems([]);
        return;
      }

      setAuthorised(true);

      const { data, error } = await supabase
        .from("problems")
        .select(
          "id, name, grade_label, v_grade, hold_colour, hold_colour_hex, wall_angle, description, reference_photo_url, start_description, finish_description, created_by, created_at",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setProblems(data ?? []);
    } catch (error) {
      console.error("Error loading moderation dashboard:", error);

      Alert.alert(
        "Dashboard error",
        error instanceof Error
          ? error.message
          : "Unable to load moderation submissions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function moderateProblem(
    problem: Problem,
    decision: "approved" | "rejected",
    reason?: string,
  ) {
    setProcessing(true);

    try {
      const { error } = await supabase.rpc("moderate_problem", {
        target_problem_id: problem.id,
        decision,
        rejection_reason: reason ?? null,
      });

      if (error) throw error;

      setProblems((current) =>
        current.filter((item) => item.id !== problem.id),
      );

      setSelectedProblem(null);
      setRejectVisible(false);
      setRejectionReason("");

      Alert.alert(
        decision === "approved" ? "Problem approved" : "Problem rejected",
        decision === "approved"
          ? "The problem is now visible on its wall page."
          : "The submission has been rejected.",
      );
    } catch (error) {
      console.error("Moderation action failed:", error);

      Alert.alert(
        "Action failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  }

  function confirmApproval(problem: Problem) {
    Alert.alert(
      "Approve problem?",
      `Approve "${problem.name}" and make it visible to the community?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => moderateProblem(problem, "approved"),
        },
      ],
    );
  }

  function openRejection(problem: Problem) {
    setSelectedProblem(problem);
    setRejectionReason("");
    setRejectVisible(true);
  }

  async function submitRejection() {
    if (!selectedProblem) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      Alert.alert(
        "Reason required",
        "Please provide a reason for rejecting this submission.",
      );
      return;
    }

    await moderateProblem(selectedProblem, "rejected", reason);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.mutedText}>Checking moderation access...</Text>
      </View>
    );
  }

  if (!authorised) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.deniedContent}>
          <Text style={styles.logo}>SEND SYD.</Text>
          <Text style={styles.deniedIcon}>🔒</Text>
          <Text style={styles.deniedTitle}>Restricted access</Text>
          <Text style={styles.mutedText}>
            This area is only available to authorised moderators, admins and the
            owner.
          </Text>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>GO BACK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SEND SYD.</Text>
            <Text style={styles.headerSubtitle}>MODERATION CENTRE</Text>
          </View>

          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        {/* TITLE */}

        <View style={styles.titleSection}>
          <Text style={styles.title}>Moderation</Text>
          <Text style={styles.mutedText}>
            Review community submissions before they go live.
          </Text>
        </View>

        {/* SUMMARY */}

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>PENDING PROBLEMS</Text>
            <Text style={styles.summaryNumber}>{problems.length}</Text>
          </View>

          <View style={styles.pendingIcon}>
            <Text style={styles.pendingEmoji}>⏳</Text>
          </View>
        </View>

        {/* QUEUE */}

        <View style={styles.queueHeader}>
          <Text style={styles.sectionTitle}>Problem submissions</Text>

          <Pressable
            onPress={() => {
              setRefreshing(true);
              loadDashboard();
            }}
          >
            <Text style={styles.refreshText}>↻ REFRESH</Text>
          </Pressable>
        </View>

        {problems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✓</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.mutedText}>
              There are no pending problem submissions.
            </Text>
          </View>
        ) : (
          problems.map((problem) => (
            <View key={problem.id} style={styles.problemCard}>
              {problem.reference_photo_url ? (
                <Image
                  source={{ uri: problem.reference_photo_url }}
                  style={styles.problemImage}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.problemContent}>
                <View style={styles.cardTopRow}>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>PENDING</Text>
                  </View>

                  <Text style={styles.dateText}>
                    {formatDate(problem.created_at)}
                  </Text>
                </View>

                <Text style={styles.problemName}>{problem.name}</Text>

                <View style={styles.tagRow}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{problem.grade_label}</Text>
                  </View>

                  {problem.v_grade ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{problem.v_grade}</Text>
                    </View>
                  ) : null}

                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{problem.hold_colour}</Text>
                  </View>

                  {problem.wall_angle ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{problem.wall_angle}</Text>
                    </View>
                  ) : null}
                </View>

                {problem.description ? (
                  <Text style={styles.description}>{problem.description}</Text>
                ) : null}

                <Pressable
                  style={styles.detailsButton}
                  onPress={() => setSelectedProblem(problem)}
                >
                  <Text style={styles.detailsButtonText}>
                    VIEW FULL SUBMISSION
                  </Text>
                </Pressable>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.rejectButton}
                    disabled={processing}
                    onPress={() => openRejection(problem)}
                  >
                    <Text style={styles.rejectButtonText}>REJECT</Text>
                  </Pressable>

                  <Pressable
                    style={styles.approveButton}
                    disabled={processing}
                    onPress={() => confirmApproval(problem)}
                  >
                    <Text style={styles.approveButtonText}>APPROVE</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>SEND SYD · MODERATION CENTRE</Text>
      </ScrollView>

      {/* FULL SUBMISSION MODAL */}

      <Modal
        visible={!!selectedProblem && !rejectVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProblem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Submission details</Text>

                <Pressable onPress={() => setSelectedProblem(null)}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>

              {selectedProblem?.reference_photo_url ? (
                <Image
                  source={{
                    uri: selectedProblem.reference_photo_url,
                  }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              ) : null}

              <Text style={styles.problemName}>{selectedProblem?.name}</Text>

              <Text style={styles.detailText}>
                Grade: {selectedProblem?.grade_label}
              </Text>

              <Text style={styles.detailText}>
                V-grade: {selectedProblem?.v_grade ?? "Not provided"}
              </Text>

              <Text style={styles.detailText}>
                Hold colour: {selectedProblem?.hold_colour}
              </Text>

              <Text style={styles.detailText}>
                Wall angle: {selectedProblem?.wall_angle ?? "Not provided"}
              </Text>

              <Text style={styles.detailHeading}>DESCRIPTION</Text>

              <Text style={styles.detailText}>
                {selectedProblem?.description || "No description provided."}
              </Text>

              <Text style={styles.detailHeading}>STARTING HOLDS</Text>

              <Text style={styles.detailText}>
                {selectedProblem?.start_description || "Not provided"}
              </Text>

              <Text style={styles.detailHeading}>FINISHING HOLDS</Text>

              <Text style={styles.detailText}>
                {selectedProblem?.finish_description || "Not provided"}
              </Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => {
                    if (selectedProblem) {
                      openRejection(selectedProblem);
                    }
                  }}
                >
                  <Text style={styles.rejectButtonText}>REJECT</Text>
                </Pressable>

                <Pressable
                  style={styles.approveButton}
                  onPress={() => {
                    if (selectedProblem) {
                      confirmApproval(selectedProblem);
                    }
                  }}
                >
                  <Text style={styles.approveButtonText}>APPROVE</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REJECTION MODAL */}

      <Modal
        visible={rejectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModal}>
            <Text style={styles.modalTitle}>Reject submission</Text>

            <Text style={styles.mutedText}>
              Explain why this problem cannot be approved. The reason will be
              recorded in moderation history.
            </Text>

            <TextInput
              style={styles.reasonInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason..."
              placeholderTextColor={theme.muted}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            {processing ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => setRejectVisible(false)}
                >
                  <Text style={styles.rejectButtonText}>CANCEL</Text>
                </Pressable>

                <Pressable
                  style={styles.approveButton}
                  onPress={submitRejection}
                >
                  <Text style={styles.approveButtonText}>
                    CONFIRM REJECTION
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.processingText}>Processing submission...</Text>
        </View>
      )}
    </View>
  );
}

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
    content: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      gap: 15,
    },
    mutedText: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logo: {
      color: theme.accent,
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: 2,
    },
    headerSubtitle: {
      color: theme.muted,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.5,
      marginTop: 5,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonText: {
      color: theme.text,
      fontSize: 18,
    },
    titleSection: {
      marginTop: 38,
      marginBottom: 25,
      gap: 7,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "900",
    },
    summaryCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      color: theme.muted,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },
    summaryNumber: {
      color: theme.text,
      fontSize: 38,
      fontWeight: "900",
      marginTop: 5,
    },
    pendingIcon: {
      backgroundColor: "#D7E65A22",
      width: 55,
      height: 55,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    pendingEmoji: {
      fontSize: 25,
    },
    queueHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 35,
      marginBottom: 15,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "900",
    },
    refreshText: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
    },
    emptyState: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 15,
      alignItems: "center",
      padding: 35,
      gap: 10,
    },
    emptyEmoji: {
      color: theme.accent,
      fontSize: 32,
      fontWeight: "900",
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },
    problemCard: {
      backgroundColor: theme.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      marginBottom: 16,
    },
    problemImage: {
      width: "100%",
      height: 185,
      backgroundColor: theme.border,
    },
    problemContent: {
      padding: 16,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    pendingBadge: {
      backgroundColor: "#FFB84D22",
      borderRadius: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    pendingBadgeText: {
      color: "#FFB84D",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
    },
    dateText: {
      color: theme.muted,
      fontSize: 9,
    },
    problemName: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
      marginTop: 14,
      marginBottom: 12,
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    tag: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    tagText: {
      color: theme.text,
      fontSize: 9,
      fontWeight: "700",
    },
    description: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 13,
    },
    detailsButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      alignItems: "center",
      marginTop: 16,
    },
    detailsButtonText: {
      color: theme.text,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    rejectButton: {
      flex: 1,
      backgroundColor: "#FF6B5F18",
      borderWidth: 1,
      borderColor: "#FF6B5F55",
      borderRadius: 9,
      minHeight: 45,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    rejectButtonText: {
      color: "#FF6B5F",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    approveButton: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 9,
      minHeight: 45,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    approveButtonText: {
      color: "#191E1C",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "center",
      padding: 18,
    },
    modalContent: {
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 20,
      maxHeight: "85%",
    },
    rejectModal: {
      backgroundColor: theme.background,
      borderRadius: 20,
      padding: 22,
      gap: 15,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
    },
    modalImage: {
      width: "100%",
      height: 190,
      borderRadius: 12,
      marginBottom: 15,
    },
    detailHeading: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
      marginTop: 18,
      marginBottom: 6,
    },
    detailText: {
      color: theme.muted,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 5,
    },
    reasonInput: {
      backgroundColor: theme.surface,
      color: theme.text,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 10,
      minHeight: 110,
      padding: 13,
      fontSize: 12,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 25,
      paddingVertical: 13,
      marginTop: 25,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: "900",
    },
    deniedContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
    },
    deniedIcon: {
      fontSize: 45,
      marginTop: 55,
    },
    deniedTitle: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
      marginTop: 20,
      marginBottom: 10,
    },
    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    processingText: {
      color: "#F4F3ED",
      fontSize: 12,
      fontWeight: "700",
    },
    footer: {
      color: theme.muted,
      fontSize: 8,
      textAlign: "center",
      fontWeight: "800",
      letterSpacing: 1,
      marginTop: 35,
    },
  });
}
