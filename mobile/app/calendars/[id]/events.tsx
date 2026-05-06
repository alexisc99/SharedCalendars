import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Pressable,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";
import type { CursorPage, EventListItem } from "../../../src/lib/types";

export default function CalendarEventsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const [items, setItems] = useState<EventListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFirstPage() {
    if (!calendarId) return;

    setError(null);
    setLoadingFirst(true);

    try {
      const res = await api.get<CursorPage<EventListItem>>(
        `/calendars/${calendarId}/events`,
      );
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoadingFirst(false);
    }
  }

  async function loadMore() {
    if (!calendarId) return;
    if (!nextCursor) return;
    if (loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await api.get<CursorPage<EventListItem>>(
        `/calendars/${calendarId}/events?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      // on évite de casser l'écran pour un loadMore
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadFirstPage();
  }, [calendarId]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Événements" }} />

      {loadingFirst ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={loadFirstPage}
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
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>Événements</Text>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/calendars/[id]/create-event",
                  params: { id: calendarId },
                })
              }
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
              }}
            >
              <Text>Créer</Text>
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(e) => e.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/events/[id]",
                    params: { id: item.id },
                  })
                }
                style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600" }}>
                  {item.title}
                </Text>
                <Text>
                  {item.startDateTime} → {item.endDateTime}
                </Text>
                <Text>
                  Commentaires: {item.commentsCount} • Fichiers:{" "}
                  {item.filesCount}
                </Text>
              </Pressable>
            )}
            onEndReached={() => {
              // éviter un déclenchement trop agressif
              if (nextCursor) loadMore();
            }}
            onEndReachedThreshold={0.6}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            onRefresh={loadFirstPage}
            refreshing={loadingFirst}
          />
        </View>
      )}
    </View>
  );
}
