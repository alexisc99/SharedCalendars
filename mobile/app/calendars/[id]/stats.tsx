import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";
import { Avatar } from "../../../components/avatar";

type CalendarStats = {
  totals: {
    eventsCreated: number;
    eventsPublished: number;
    commentsCreated: number;
    filesUploaded: number;
  };
  activity: {
    last7Days: number;
    last30Days: number;
  };
  topContributors: {
    userId: string;
    name: string | null;
    avatarUrl: string | null;
    actions: number;
  }[];
};

export default function CalendarStatsScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const nameRaw = params.name;
  const calendarName = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
  const themeRaw = params.theme;
  const calendarColor = colorForTheme(Array.isArray(themeRaw) ? themeRaw[0] : themeRaw);

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CalendarStats | null>(null);

  async function load() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<CalendarStats>(`/stats/calendar/${calendarId}`);
      setData(res);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [calendarId]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · Statistiques` : "Statistiques",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={load}
            style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
          >
            <Text>Réessayer</Text>
          </Pressable>
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "Événements créés", value: data.totals.eventsCreated },
              { label: "Événements publiés", value: data.totals.eventsPublished },
              { label: "Commentaires", value: data.totals.commentsCreated },
              { label: "Fichiers", value: data.totals.filesUploaded },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flexBasis: "47%",
                  flexGrow: 1,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: "700" }}>{item.value}</Text>
                <Text style={{ opacity: 0.7, fontSize: 12 }}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ fontWeight: "600" }}>Activité récente</Text>
            <Text>{data.activity.last7Days} action{data.activity.last7Days > 1 ? "s" : ""} — 7 derniers jours</Text>
            <Text>{data.activity.last30Days} action{data.activity.last30Days > 1 ? "s" : ""} — 30 derniers jours</Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "600" }}>Contributeurs les plus actifs</Text>
            {data.topContributors.length === 0 ? (
              <Text style={{ opacity: 0.6 }}>Aucune activité pour l'instant</Text>
            ) : (
              data.topContributors.map((c, i) => (
                <View
                  key={c.userId}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1 }}
                >
                  <Text style={{ opacity: 0.5, width: 18 }}>{i + 1}</Text>
                  <Avatar uri={c.avatarUrl} name={c.name} size={28} />
                  <Text style={{ flex: 1 }}>{c.name ?? "Utilisateur"}</Text>
                  <Text style={{ opacity: 0.7 }}>{c.actions} action{c.actions > 1 ? "s" : ""}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
