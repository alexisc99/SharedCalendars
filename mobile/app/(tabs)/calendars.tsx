import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { api, ApiError } from "../../src/lib/api";
import type { CalendarSummary } from "../../src/lib/types";
import { useRouter } from "expo-router";

export default function CalendarsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CalendarSummary[]>([]);
  const router = useRouter();

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<CalendarSummary[]>("/calendars/my");
      setItems(data);
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

  if (error) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
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
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable
          onPress={() => router.push("/calendars/new")}
          style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" }}
        >
          <Text>+ Nouveau</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/join")}
          style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" }}
        >
          <Text>Rejoindre via lien</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendars/[id]",
                params: { id: item.id },
              })
            }
            style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
            <Text>Rôle: {item.role}</Text>
            <Text>
              Membres: {item.membersCount} • Événements: {item.eventsCount}
            </Text>
            <Text>Premium: {item.isPremium ? "Oui" : "Non"}</Text>
            <Text>
              ICS public: {item.publicIcsEnabled ? "Activé" : "Désactivé"}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>Aucun calendrier</Text>}
        onRefresh={load}
        refreshing={loading}
      />
    </View>
  );
}
