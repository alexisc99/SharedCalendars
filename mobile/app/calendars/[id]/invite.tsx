import React, { useState } from "react";
import { View, Text, Pressable, Share, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";

type InvitationResponse = {
  success: boolean;
  id: string;
  data: { id: string; calendarId: string; token: string; createdAt: string };
};

export default function InviteScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const nameRaw = params.name;
  const calendarName = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
  const themeRaw = params.theme;
  const calendarTheme = Array.isArray(themeRaw) ? themeRaw[0] : themeRaw;
  const calendarColor = colorForTheme(calendarTheme);

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function generate() {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<InvitationResponse>(`/calendars/${id}/invitations`);
      setToken(res.data.token);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    if (!token) return;
    try {
      await Share.share({
        message: `Rejoins mon calendrier MyApp : ${token}`,
      });
    } catch {
      // ignore
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · Inviter` : "Inviter",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ opacity: 0.7 }}>
        Génère un lien d'invitation. Le destinataire le saisira dans « Rejoindre via lien ».
      </Text>

      {!token ? (
        <Pressable
          onPress={generate}
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <ActivityIndicator /> : <Text>Générer un lien</Text>}
        </Pressable>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={{ padding: 12, borderRadius: 10, borderWidth: 1 }}>
            <Text style={{ opacity: 0.6, marginBottom: 4 }}>Token</Text>
            <Text selectable style={{ fontFamily: "Courier" }}>
              {token}
            </Text>
          </View>
          <Pressable
            onPress={share}
            style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
          >
            <Text>Partager</Text>
          </Pressable>
          <Pressable
            onPress={generate}
            disabled={loading}
            style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, opacity: loading ? 0.6 : 1 }}
          >
            <Text>Régénérer un autre lien</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      </View>
    </View>
  );
}
