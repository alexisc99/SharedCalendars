import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { GoogleLogo } from "../../components/google-logo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useSession } from "../../src/lib/session";
import { api } from "../../src/lib/api"; // IMPORTANT: utiliser ton wrapper qui met le Bearer
import { useRouter } from "expo-router";

export default function IntegrationsScreen() {
  const { me } = useSession();
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { refreshMe } = useSession();

  async function connectGoogle() {
    setLoading(true);
    try {
      const returnUrl = Linking.createURL("/oauth/success");

      const { url } = await api.get<{ url: string }>(
        `/integrations/google/connect-url?returnUrl=${encodeURIComponent(returnUrl)}`,
      );

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

      // IMPORTANT: on force l'UI, même si le deep link n'a pas "ramené" l'app
      if (result.type === "success" || result.type === "dismiss") {
        await refreshMe();
        router.replace("/(tabs)/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Intégrations</Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <GoogleLogo size={20} />
        <Text>
          Google: {me?.integrations.googleConnected ? "Connecté" : "Non connecté"}
        </Text>
      </View>

      <Pressable
        onPress={connectGoogle}
        disabled={loading}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <GoogleLogo size={18} />
        <Text>{loading ? "Ouverture..." : "Connecter Google"}</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/integrations/google/import")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
        }}
      >
        <GoogleLogo size={18} />
        <Text>Importer des événements Google</Text>
      </Pressable>
    </View>
  );
}
