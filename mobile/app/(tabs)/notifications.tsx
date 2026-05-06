import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/lib/api";
import type { CursorPage, NotificationItem } from "../../src/lib/types";
import { useSession } from "../../src/lib/session";

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFirst() {
    setError(null);
    setLoadingFirst(true);
    try {
      const res = await api.get<CursorPage<NotificationItem>>("/notifications/list");
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoadingFirst(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get<CursorPage<NotificationItem>>(
        `/notifications/list?cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))
      );
      await refreshMe(); // badge unreadCount
    } catch {}
  }

  async function openNotification(n: NotificationItem) {
    if (!n.readAt) await markRead(n.id);
    if (n.eventId) {
      router.push({ pathname: "/events/[id]", params: { id: n.eventId } });
    }
  }

  useEffect(() => {
    loadFirst();
  }, []);

  if (loadingFirst) {
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
          onPress={loadFirst}
          style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
        >
          <Text>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const unread = item.readAt === null;

          return (
            <Pressable
              onPress={() => openNotification(item)}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                opacity: unread ? 1 : 0.6,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
              {item.message ? <Text>{item.message}</Text> : null}
              <Text style={{ opacity: 0.7, marginTop: 4 }}>
                {unread ? "Non lu" : "Lu"} • {item.createdAt}
              </Text>

              {unread ? (
                <Pressable
                  onPress={() => markRead(item.id)}
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1,
                  }}
                >
                  <Text>Marquer comme lu</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
        onRefresh={loadFirst}
        refreshing={loadingFirst}
        ListEmptyComponent={<Text>Aucune notification</Text>}
      />
    </View>
  );
}
