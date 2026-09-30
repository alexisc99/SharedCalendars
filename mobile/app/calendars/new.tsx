import React, { useState } from "react";
import { ScrollView } from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { TextInput } from "@/components/themed/text-input";
import { Stack, useRouter } from "expo-router";
import { api, ApiError } from "../../src/lib/api";
import { FREE_THEMES, THEME_COLORS, colorForTheme } from "../../src/lib/theme";
import { HomeHeaderButton } from "../../components/home-header-button";

type CreateCalendarResponse = {
  success: boolean;
  id: string;
  data: { id: string; name: string };
};

export default function NewCalendarScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [theme, setTheme] = useState("default");
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
      const body: Record<string, unknown> = {
        name: name.trim(),
        theme,
        color: colorForTheme(theme),
      };

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
      <Stack.Screen
        options={{
          title: "Nouveau calendrier",
          headerShown: true,
          headerRight: () => <HomeHeaderButton />,
        }}
      />

      <Text>Nom *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Thème</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {FREE_THEMES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTheme(t)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: theme === t ? 2 : 1,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: THEME_COLORS[t],
              }}
            />
            <Text>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        Plus de thèmes disponibles une fois le calendrier passé en premium ✨
      </Text>

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colorForTheme(theme),
          opacity: submitting ? 0.6 : 1,
        }}
      >
        <Text>{submitting ? "Création..." : "Créer le calendrier"}</Text>
      </Pressable>
    </ScrollView>
  );
}
