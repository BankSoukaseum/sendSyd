import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  gyms: "map-outline",
  upload: "add-circle",
  community: "people-outline",
  profile: "person-circle-outline",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#D7E65A",
        tabBarInactiveTintColor: "#89938B",

        tabBarStyle: {
          backgroundColor: "#111512",
          borderTopColor: "#303A33",
          borderTopWidth: 1,
          height: 85,
          paddingTop: 10,
          paddingBottom: 20,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },

        tabBarIcon: ({ color, size, focused }) => {
          const iconName = tabIcons[route.name] ?? "ellipse-outline";

          return (
            <Ionicons
              name={iconName}
              size={focused ? size + 2 : size}
              color={color}
            />
          );
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="gyms"
        options={{
          title: "Gyms",
        }}
      />

      <Tabs.Screen
        name="upload"
        options={{
          title: "Upload",
          tabBarLabel: "Upload",
        }}
      />

      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarLabel: "Community",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
