import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { api, ApiError } from "../../src/lib/api";

type CreateCalendarResponse = {
  success: boolean;
  id: string;
  data: { id: string; name: string };
};

export default function NewCalendarScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [theme, setTheme] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Le nom est requis");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (color.trim()) body.color = color.trim();
      if (theme.trim()) body.theme = theme.trim();

      const res = await api.post<CreateCalendarResponse>("/calendars", body);
      router.replace({ pathname: "/calendars/[id]", params: { id: res.data.id } });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "Nouveau calendrier" }} />

      <Text>Nom *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Couleur (optionnel — ex. #4f46e5)</Text>
      <TextInput
        value={color}
        onChangeText={setColor}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Thème (optionnel)</Text>
      <TextInput
        value={theme}
        onChangeText={setTheme}
        autoCapitalize="none"
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
        <Text>{submitting ? "Création..." : "Créer le calendrier"}</Text>
      </Pressable>
    </ScrollView>
  );
}
