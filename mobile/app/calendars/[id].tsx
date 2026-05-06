import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { api, ApiError } from "../../src/lib/api";

type CalendarHomeResponse = {
  calendar: {
    id: string;
    name: string;
    color: string;
    theme: string;
    isPremium: boolean;
    publicIcsEnabled: boolean;
    role: string;
  };
  members: {
    total: number;
    premiumSeats: number | null;
  };
  upcomingEvents: Array<{
    id: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
  }>;
  activity: {
    last7d: { events: number; comments: number; files: number };
    last30d: { events: number; comments: number; files: number };
  };
  integrations: {
    google: { enabled: boolean; syncMode: "MANUAL" };
  };
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canManagePremium: boolean;
  };
};

export default function CalendarHomeScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;

  // Expo Router peut donner string | string[]
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CalendarHomeResponse | null>(null);

  async function load() {
    if (!id) {
      setError("ID calendrier manquant");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get<CalendarHomeResponse>(`/calendars/${id}/home`);
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
  }, [id]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: data?.calendar?.name ?? "Calendrier" }} />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={load}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
            }}
          >
            <Text>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>
            {data?.calendar.name}
          </Text>
          <Text>Rôle: {data?.calendar.role}</Text>
          <Text>Membres: {data?.members.total}</Text>
          <Text>Premium: {data?.calendar.isPremium ? "Oui" : "Non"}</Text>

          <Text style={{ marginTop: 8, fontWeight: "600" }}>
            Prochains événements
          </Text>
          {(data?.upcomingEvents ?? []).map((ev) => (
            <View key={ev.id} style={{ paddingVertical: 6 }}>
              <Text style={{ fontWeight: "500" }}>{ev.title}</Text>
              <Text>
                {ev.startDateTime} → {ev.endDateTime}
              </Text>
            </View>
          ))}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendars/[id]/events",
                params: { id },
              })
            }
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              marginTop: 8,
            }}
          >
            <Text>Voir tous les événements</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/calendars/[id]/ics", params: { id } })
            }
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              marginTop: 8,
            }}
          >
            <Text>ICS public</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
