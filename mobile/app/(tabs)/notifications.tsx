import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/lib/api";
import type { CursorPage, NotificationItem } from "../../src/lib/types";
import { useSession } from "../../src/lib/session";
import { formatDateTime } from "../../src/lib/date";

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshMe } = useSession();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

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

  async function markUnread(id: string) {
    try {
      await api.patch(`/notifications/${id}/unread`, {});
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: null } : n))
      );
      await refreshMe(); // badge unreadCount
    } catch {}
  }

  function deleteNotification(id: string) {
    Alert.alert(
      "Supprimer la notification",
      "Confirmer la suppression ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.del(`/notifications/${id}`);
              setItems((prev) => prev.filter((n) => n.id !== id));
              await refreshMe(); // badge unreadCount
            } catch {}
          },
        },
      ],
    );
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected({});
  }

  function toggleSelected(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelectAll() {
    if (selectedIds.length === items.length) {
      setSelected({});
    } else {
      setSelected(Object.fromEntries(items.map((n) => [n.id, true])));
    }
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;
    Alert.alert(
      "Supprimer les notifications",
      `Confirmer la suppression de ${selectedIds.length} notification${selectedIds.length > 1 ? "s" : ""} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setBulkDeleting(true);
            try {
              await api.post("/notifications/bulk-delete", { ids: selectedIds });
              const removed = new Set(selectedIds);
              setItems((prev) => prev.filter((n) => !removed.has(n.id)));
              setSelected({});
              setSelectMode(false);
              await refreshMe(); // badge unreadCount
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "La suppression a échoué");
            } finally {
              setBulkDeleting(false);
            }
          },
        },
      ],
    );
  }

  async function openNotification(n: NotificationItem) {
    if (selectMode) {
      toggleSelected(n.id);
      return;
    }
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
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {selectMode ? (
          <>
            <Pressable
              onPress={toggleSelectAll}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 }}
            >
              <Text>
                {selectedIds.length === items.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Text>
            </Pressable>
            <Pressable
              onPress={deleteSelected}
              disabled={selectedIds.length === 0 || bulkDeleting}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                opacity: selectedIds.length === 0 || bulkDeleting ? 0.5 : 1,
              }}
            >
              {bulkDeleting ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={{ color: "red" }}>Supprimer ({selectedIds.length})</Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={toggleSelectMode}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 }}
            >
              <Text>Annuler</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={toggleSelectMode}
              disabled={items.length === 0}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                opacity: items.length === 0 ? 0.5 : 1,
              }}
            >
              <Text>Sélectionner</Text>
            </Pressable>
          </>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const unread = item.readAt === null;
          const checked = !!selected[item.id];

          return (
            <Pressable
              onPress={() => openNotification(item)}
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: checked ? 2 : 1,
                borderColor: checked ? "#4f46e5" : undefined,
                opacity: unread || checked ? 1 : 0.6,
                flexDirection: "row",
                gap: 10,
              }}
            >
              {selectMode ? (
                <Text style={{ fontSize: 16 }}>{checked ? "☑" : "☐"}</Text>
              ) : null}

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
                {item.message ? <Text>{item.message}</Text> : null}
                <Text style={{ opacity: 0.7, marginTop: 4 }}>
                  {unread ? "Non lu" : "Lu"} • {formatDateTime(item.createdAt)}
                </Text>

                {!selectMode ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => (unread ? markRead(item.id) : markUnread(item.id))}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        borderWidth: 1,
                      }}
                    >
                      <Text>{unread ? "Marquer comme lu" : "Marquer comme non lu"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteNotification(item.id)}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ color: "red" }}>Supprimer</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
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
