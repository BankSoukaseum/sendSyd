import { supabase } from "./supabase";

export type Rotation = {
  id: string;
  wall_id: string;
  rotation_number: number;
  name: string;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function getActiveRotationByWallId(
  wallId: string,
): Promise<Rotation | null> {
  const { data, error } = await supabase
    .from("rotations")
    .select("*")
    .eq("wall_id", wallId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching active rotation:", error);
    throw error;
  }

  return data;
}

export async function getRotationsByWallId(
  wallId: string,
): Promise<Rotation[]> {
  const { data, error } = await supabase
    .from("rotations")
    .select("*")
    .eq("wall_id", wallId)
    .order("rotation_number", { ascending: false });

  if (error) {
    console.error("Error fetching rotation history:", error);
    throw error;
  }

  return data ?? [];
}
