import { supabase } from "./supabase";

export type Wall = {
  id: string;
  gym_id: string;
  name: string;
  wall_type: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export async function getWallsByGymId(gymId: string): Promise<Wall[]> {
  console.log("========== WALL FETCH START ==========");
  console.log("Gym ID:", gymId);

  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  console.log("Wall data:", JSON.stringify(data, null, 2));
  console.log("Wall error:", error);
  console.log("Number of walls:", data?.length ?? 0);
  console.log("========== WALL FETCH END ==========");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getWallById(wallId: string): Promise<Wall | null> {
  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .eq("id", wallId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching individual wall:", error);
    throw error;
  }

  return data;
}
