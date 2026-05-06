import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError } from "../../src/lib/api";
import type { DashboardStatsDto } from "../../src/lib/types";

export default function DashboardScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardStatsDto | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<DashboardStatsDto>("/stats/dashboard");
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
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ color: "red" }}>{error ?? "Erreur inconnue"}</Text>
        <Pressable
          onPress={load}
          style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
        >
          <Text>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      {/* Notifications */}
      <Pressable
        onPress={() => router.push("/(tabs)/notifications")}
        style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Notifications</Text>
        <Text>Non lues: {data.unreadNotifications}</Text>
      </Pressable>

      {/* Upcoming events */}
      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Prochains événements</Text>

        {data.upcomingEvents.length === 0 ? (
          <Text>Aucun événement à venir</Text>
        ) : (
          data.upcomingEvents.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push({ pathname: "/events/[id]", params: { id: e.id } })}
              style={{ padding: 10, borderRadius: 10, borderWidth: 1 }}
            >
              <Text style={{ fontWeight: "600" }}>{e.title}</Text>
              <Text style={{ opacity: 0.75 }}>{e.startDateTime} → {e.endDateTime}</Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Calendars + activity */}
      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Mes calendriers</Text>

        {data.calendars.length === 0 ? (
          <Text>Aucun calendrier</Text>
        ) : (
          data.calendars.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: "/calendars/[id]", params: { id: c.id } })}
              style={{ padding: 10, borderRadius: 10, borderWidth: 1 }}
            >
              <Text style={{ fontWeight: "600" }}>{c.name}</Text>
              <Text>
                Rôle: {c.role} • Membres: {c.membersCount} • Events: {c.eventsCount}
              </Text>
              <Text style={{ opacity: 0.75 }}>
                7j: {c.activity.last7d.eventsCreated} créés • {c.activity.last7d.comments} com • {c.activity.last7d.files} fichiers
              </Text>
              <Text style={{ opacity: 0.75 }}>
                30j: {c.activity.last30d.eventsCreated} créés • {c.activity.last30d.comments} com • {c.activity.last30d.files} fichiers
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable
        onPress={load}
        style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
      >
        <Text>Rafraîchir</Text>
      </Pressable>
    </ScrollView>
  );
}