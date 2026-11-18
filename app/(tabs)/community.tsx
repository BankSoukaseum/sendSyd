import { View, Text, StyleSheet } from "react-native";

export default function Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SEND SYD.</Text>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.subtitle}>We're building something exciting.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111512",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: "#D7E65A",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 18,
  },
  title: {
    color: "#F4F3ED",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9AA49C",
    fontSize: 13,
    marginTop: 10,
  },
});
