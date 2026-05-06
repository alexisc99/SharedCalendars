import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "../../src/lib/session";

export default function OAuthSuccess() {
  const router = useRouter();
  const { refreshMe } = useSession();

  useEffect(() => {
    (async () => {
      await refreshMe();           // googleConnected doit devenir true
      router.replace("/(tabs)");   // retour app
    })();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 10 }}>Connexion Google réussie…</Text>
    </View>
  );
}
