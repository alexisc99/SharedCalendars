import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";
import type {
  CalendarSummary,
  GoogleImportableEvent,
  GoogleImportableResponse,
  GoogleImportPageResult,
} from "../../../src/lib/types";

export default function GoogleImportScreen() {
  // calendars (target)
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [targetCalendarId, setTargetCalendarId] = useState<string | null>(null);

  // google importables
  const [items, setItems] = useState<GoogleImportableEvent[]>([]);
  const [currentPageToken, setCurrentPageToken] = useState<string | null>(null); // <-- page affichée
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [importingSelection, setImportingSelection] = useState(false);
  const [importingPage, setImportingPage] = useState(false);

  const [lastResult, setLastResult] = useState<GoogleImportPageResult | null>(
    null,
  );

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [selected],
  );

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function loadCalendars() {
    setCalError(null);
    setCalLoading(true);
    try {
      const res = await api.get<CalendarSummary[]>("/calendars/my");
      setCalendars(res);

      const firstId = res[0]?.id ?? null;
      if (!targetCalendarId && firstId) {
        setTargetCalendarId(firstId);
        await loadFirst(firstId); // <-- IMPORTANT: on passe l'id ici
      } else if (targetCalendarId) {
        await loadFirst(targetCalendarId);
      }
    } catch (e: any) {
      if (e instanceof ApiError) setCalError(e.message);
      else setCalError("Erreur inconnue");
    } finally {
      setCalLoading(false);
    }
  }

  async function loadPage(calendarId: string, pageToken: string | null) {
    setError(null);

    // DEBUG temporaire (à enlever après)
    const base = `/integrations/google/events/importable?calendarId=${encodeURIComponent(calendarId)}`;
    const url = pageToken
      ? `${base}&pageToken=${encodeURIComponent(pageToken)}`
      : base;
    console.log("[google import] GET", url);

    try {
      const res = await api.get<GoogleImportableResponse>(url);

      if (!pageToken) {
        setItems(res.items);
        setSelected({});
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }

      setCurrentPageToken(pageToken);
      setNextPageToken(res.nextPageToken ?? null);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    }
  }

  async function loadFirst(calendarId: string) {
    setLastResult(null);
    setLoadingFirst(true);
    await loadPage(calendarId, null);
    setLoadingFirst(false);
  }

  async function loadMore() {
    if (!targetCalendarId || !nextPageToken || loadingMore) return;
    setLoadingMore(true);
    await loadPage(targetCalendarId, nextPageToken);
    setLoadingMore(false);
  }

  async function importSelected() {
    if (!targetCalendarId) {
      setError("Choisis un calendrier MyApp");
      return;
    }
    if (selectedIds.length === 0) return;

    setImportingSelection(true);
    setError(null);
    setLastResult(null);

    try {
      for (const googleEventId of selectedIds) {
        await api.post("/integrations/google/import", {
          googleEventId,
          calendarId: targetCalendarId,
          // googleCalendarId optionnel
        });
      }
      await loadFirst(targetCalendarId);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setImportingSelection(false);
    }
  }

  async function importThisPage() {
    if (!targetCalendarId) {
      setError("Choisis un calendrier MyApp");
      return;
    }

    setImportingPage(true);
    setError(null);
    setLastResult(null);

    try {
      const res = await api.post<GoogleImportPageResult>(
        "/integrations/google/import/page",
        {
          calendarId: targetCalendarId,
          // page courante (null pour la première page)
          pageToken: currentPageToken ?? undefined,
          // optionnel: googleCalendarId/timeMin/timeMax/maxResults si tu les ajoutes plus tard
        },
      );

      setLastResult(res);

      // Rafraîchir la liste importable (strict) après import
      await loadFirst(targetCalendarId);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setImportingPage(false);
    }
  }

  useEffect(() => {
    loadCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (targetCalendarId) {
      loadFirst(targetCalendarId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCalendarId]);
  const ready = !loadingFirst && !calLoading;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Importer depuis Google" }} />

      {!ready ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : calError ? (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{calError}</Text>
          <Pressable
            onPress={loadCalendars}
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
      ) : error ? (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={() => {
              if (targetCalendarId) loadFirst(targetCalendarId);
            }}
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
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <Text style={{ fontWeight: "600" }}>Importer dans :</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {calendars.map((c) => {
              const active = c.id === targetCalendarId;
              return (
                <Pressable
                  key={c.id}
                  onPress={async () => {
                    setTargetCalendarId(c.id);
                    setItems([]);
                    setSelected({});
                    setNextPageToken(null);
                    setCurrentPageToken(null);
                    setLastResult(null);
                    await loadFirst(c.id); // <-- charge immédiatement le bon calendarId
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <Text>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ opacity: 0.75 }}>
            Conseil : utilise la sélection pour un meilleur contrôle (vie
            privée). “Importer cette page” importe tout ce qui est affiché sur
            cette page.
          </Text>

          {lastResult ? (
            <View style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
              <Text style={{ fontWeight: "600" }}>Résultat import page</Text>
              <Text>
                Importés: {lastResult.importedCount} / {lastResult.fetchedCount}
              </Text>
              <Text>Doublons ignorés: {lastResult.skippedDuplicates}</Text>
              <Text>Invalides ignorés: {lastResult.skippedInvalid}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={importSelected}
              disabled={
                importingSelection ||
                selectedIds.length === 0 ||
                !targetCalendarId
              }
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity:
                  importingSelection ||
                  selectedIds.length === 0 ||
                  !targetCalendarId
                    ? 0.5
                    : 1,
              }}
            >
              <Text>
                {importingSelection
                  ? "Import..."
                  : `Importer sélection (${selectedIds.length})`}
              </Text>
            </Pressable>

            <Pressable
              onPress={importThisPage}
              disabled={
                importingPage || !targetCalendarId || items.length === 0
              }
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity:
                  importingPage || !targetCalendarId || items.length === 0
                    ? 0.5
                    : 1,
              }}
            >
              <Text>{importingPage ? "Import..." : "Importer cette page"}</Text>
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(e) => e.googleEventId}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => {
              const checked = !!selected[item.googleEventId];
              return (
                <Pressable
                  onPress={() => toggle(item.googleEventId)}
                  style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600" }}>
                    {checked ? "☑ " : "☐ "}
                    {item.title ?? "(Sans titre)"}
                  </Text>
                  <Text style={{ opacity: 0.8 }}>
                    {item.allDay ? "All-day" : "Horaire"} • {item.start ?? "?"}{" "}
                    → {item.end ?? "?"}
                  </Text>
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
            ListEmptyComponent={<Text>Aucun événement importable</Text>}
            onRefresh={() => {
              if (targetCalendarId) loadFirst(targetCalendarId);
            }}
            refreshing={loadingFirst}
          />
        </View>
      )}
    </View>
  );
}
