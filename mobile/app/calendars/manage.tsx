import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { api, ApiError } from "../../src/lib/api";
import type { CalendarSummary } from "../../src/lib/types";
import { colorForTheme } from "../../src/lib/theme";
import { AuthImage } from "../../components/auth-image";

export default function ManageCalendarsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CalendarSummary[]>([]);
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    setError(null);
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<CalendarSummary[]>("/calendars/my");
      setItems(data);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge à chaque fois que l'écran reprend le focus (ex: retour après
  // avoir modifié un calendrier), pas seulement au montage.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Stack.Screen options={{ title: "Mes calendriers" }} />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable
          onPress={() => router.push("/calendars/new")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text>+ Nouveau</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/join")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            alignItems: "center",
          }}
        >
          <Text>Rejoindre via lien</Text>
        </Pressable>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={() => load()}
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
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const color = colorForTheme(item.theme);
            return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/calendars/[id]/events",
                  params: {
                    id: item.id,
                    name: item.name,
                    theme: item.theme ?? "",
                  },
                })
              }
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderLeftWidth: 4,
                borderLeftColor: color,
                overflow: "hidden",
              }}
            >
              {item.coverImageUrl ? (
                <AuthImage
                  uri={item.coverImageUrl}
                  style={{ width: "100%", aspectRatio: 16 / 9 }}
                />
              ) : null}
              <View style={{ padding: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: color,
                    }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {item.name}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/calendars/[id]",
                      params: { id: item.id },
                    })
                  }
                  hitSlop={8}
                  style={{ padding: 6 }}
                >
                  <Text style={{ fontSize: 18 }}>⚙</Text>
                </Pressable>
              </View>
              <Text>Rôle: {item.role}</Text>
              <Text>
                Membres: {item.membersCount} • Événements: {item.eventsCount}
              </Text>
              <Text>Premium: {item.isPremium ? "Oui" : "Non"}</Text>
              <Text>
                ICS public: {item.publicIcsEnabled ? "Activé" : "Désactivé"}
              </Text>
              </View>
            </Pressable>
            );
          }}
          ListEmptyComponent={<Text>Aucun calendrier</Text>}
          onRefresh={() => load(true)}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}
