import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { api, ApiError } from "../src/lib/api";

type JoinResponse = { joined: boolean; calendarId: string };

export default function JoinScreen() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);

    const trimmed = token.trim();
    if (!trimmed) {
      setError("Token requis");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.get<JoinResponse>(`/invitations/${encodeURIComponent(trimmed)}`);
      router.replace({ pathname: "/calendars/[id]", params: { id: res.calendarId } });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "Rejoindre un calendrier" }} />

      <Text style={{ opacity: 0.7 }}>Colle ici le token d'invitation reçu.</Text>

      <Text>Token</Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          opacity: submitting ? 0.6 : 1,
        }}
      >
        <Text>{submitting ? "..." : "Rejoindre"}</Text>
      </Pressable>
    </View>
  );
}
