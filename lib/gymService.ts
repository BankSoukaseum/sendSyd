import { supabase } from "./supabase";

export type Gym = {
  id: string;
  name: string;
  suburb: string | null;
  city: string;
  state: string;
  country: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
};

export async function getGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from("gyms")
    .select(
      "id, name, suburb, city, state, country, description, image_url, website",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching gyms:", error.message);
    throw error;
  }

  return data ?? [];
}

export async function getGymById(gymId: string): Promise<Gym | null> {
  console.log("Looking for gym ID:", gymId);

  const { data, error } = await supabase
    .from("gyms")
    .select("*")
    .eq("id", gymId);

  console.log("Returned gym:", data);
  console.log("Supabase error:", error);

  if (error) throw error;

  return data?.[0] ?? null;
}
