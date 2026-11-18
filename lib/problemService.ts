import { supabase } from "./supabase";

export type Problem = {
  id: string;
  rotation_id: string;
  gym_grade_id: string | null;
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
  status: "pending" | "approved" | "rejected";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateProblemInput = {
  rotationId: string;
  name: string;
  gradeLabel: string;
  vGrade?: string;
  holdColour: string;
  holdColourHex: string;
  wallAngle?: string;
  description?: string;
  referencePhotoUrl?: string;
  startDescription?: string;
  finishDescription?: string;
};

export async function getProblemsByRotationId(
  rotationId: string,
): Promise<Problem[]> {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("rotation_id", rotationId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching problems:", error);
    throw error;
  }

  return data ?? [];
}

export async function getProblemById(
  problemId: string,
): Promise<Problem | null> {
  const cleanProblemId = problemId?.trim();

  if (!cleanProblemId) {
    console.error("getProblemById received an empty problem ID.");
    return null;
  }

  console.log("Fetching problem details:", cleanProblemId);

  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", cleanProblemId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching problem by ID:", error);
    throw error;
  }

  if (!data) {
    console.warn("No readable problem found for ID:", cleanProblemId);
    return null;
  }

  console.log("Problem successfully loaded:", data.name);

  return data;
}

export async function uploadProblemPhoto(
  imageUri: string,
  userId: string,
): Promise<string> {
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error("Unable to read the selected image.");
  }

  const arrayBuffer = await response.arrayBuffer();

  const extension = imageUri.split(".").pop()?.split("?")[0]?.toLowerCase();

  const safeExtension =
    extension === "png" || extension === "webp" ? extension : "jpg";

  const contentType =
    safeExtension === "png"
      ? "image/png"
      : safeExtension === "webp"
        ? "image/webp"
        : "image/jpeg";

  const filePath = `${userId}/${Date.now()}.${safeExtension}`;

  const { error } = await supabase.storage
    .from("problem-photos")
    .upload(filePath, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Error uploading problem photo:", error);
    throw error;
  }

  const { data } = supabase.storage
    .from("problem-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function createProblem(
  input: CreateProblemInput,
): Promise<Problem> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error("You must sign in before submitting a problem.");
  }

  const { data, error } = await supabase
    .from("problems")
    .insert({
      rotation_id: input.rotationId,
      name: input.name.trim(),
      grade_label: input.gradeLabel.trim(),
      v_grade: input.vGrade?.trim() || null,
      hold_colour: input.holdColour,
      hold_colour_hex: input.holdColourHex,
      wall_angle: input.wallAngle?.trim() || null,
      description: input.description?.trim() || null,
      reference_photo_url: input.referencePhotoUrl || null,
      start_description: input.startDescription?.trim() || null,
      finish_description: input.finishDescription?.trim() || null,
      status: "pending",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating problem:", error);
    throw error;
  }

  return data;
}
