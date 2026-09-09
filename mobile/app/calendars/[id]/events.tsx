import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import { MonthCalendar, MonthCalendarEvent } from "../../../components/month-calendar";
import { UpcomingEventsPanel, UpcomingEventItem } from "../../../components/upcoming-events-panel";
import {
  endOfMonth,
  formatDate,
  formatEventRange,
  isSameDay,
  startOfMonth,
} from "../../../src/lib/date";
import type { CursorPage, EventListItem } from "../../../src/lib/types";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";

export default function CalendarEventsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const themeRaw = params.theme;
  const calendarTheme = Array.isArray(themeRaw) ? themeRaw[0] : themeRaw;
  const calendarColor = colorForTheme(calendarTheme);
  const nameRaw = params.name;
  const calendarName = (Array.isArray(nameRaw) ? nameRaw[0] : nameRaw) || "Calendrier";

  const insets = useSafeAreaInsets();

  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [monthItems, setMonthItems] = useState<EventListItem[]>([]);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [upcoming, setUpcoming] = useState<EventListItem[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  const loadMonth = useCallback(async () => {
    if (!calendarId) return;
    setMonthError(null);
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      const res = await api.get<CursorPage<EventListItem>>(
        `/calendars/${calendarId}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`,
      );
      setMonthItems(res.items);
    } catch (e: any) {
      if (e instanceof ApiError) setMonthError(e.message);
      else setMonthError("Erreur inconnue");
    }
  }, [calendarId, month]);

  const loadUpcoming = useCallback(async () => {
    if (!calendarId) return;
    setUpcomingLoading(true);
    try {
      const from = new Date().toISOString();
      const res = await api.get<CursorPage<EventListItem>>(
        `/calendars/${calendarId}/events?from=${encodeURIComponent(from)}&limit=20`,
      );
      setUpcoming(res.items);
    } catch {
      // le panneau affichera juste une liste vide en cas d'erreur silencieuse
    } finally {
      setUpcomingLoading(false);
    }
  }, [calendarId]);

  // Recharge à chaque fois que l'écran reprend le focus (ex: retour après
  // avoir créé un événement), pas seulement au montage.
  useFocusEffect(
    useCallback(() => {
      loadMonth();
      loadUpcoming();
    }, [loadMonth, loadUpcoming]),
  );

  const calendarEvents: MonthCalendarEvent[] = useMemo(
    () =>
      monthItems.map((e) => ({
        id: e.id,
        startDateTime: e.startDateTime,
        color: calendarColor,
      })),
    [monthItems, calendarColor],
  );

  const dayEvents = useMemo(
    () =>
      monthItems.filter((e) => isSameDay(new Date(e.startDateTime), selectedDate)),
    [monthItems, selectedDate],
  );

  const upcomingItems: UpcomingEventItem[] = useMemo(
    () =>
      upcoming.map((e) => ({
        id: e.id,
        title: e.title,
        startDateTime: e.startDateTime,
        endDateTime: e.endDateTime,
        color: calendarColor,
      })),
    [upcoming, calendarColor],
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName,
          headerShown: true,
          headerTintColor: calendarColor,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/calendars/[id]/create-event",
              params: { id: calendarId, name: calendarName, theme: calendarTheme ?? "" },
            })
          }
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: calendarColor,
          }}
        >
          <Text>Créer</Text>
        </Pressable>
      </View>

      {monthError ? (
        <View style={{ gap: 12, marginBottom: 16 }}>
          <Text style={{ color: "red" }}>{monthError}</Text>
          <Pressable
            onPress={loadMonth}
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
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          events={calendarEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          accentColor={calendarColor}
        />
      )}

      <View style={{ marginTop: 16, gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>{formatDate(selectedDate)}</Text>
        {dayEvents.length === 0 ? (
          <Text style={{ opacity: 0.6 }}>Aucun événement ce jour</Text>
        ) : (
          dayEvents.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({ pathname: "/events/[id]", params: { id: item.id } })
              }
              style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
              <Text style={{ opacity: 0.7 }}>
                {formatEventRange(item.startDateTime, item.endDateTime)}
              </Text>
              <Text>
                Commentaires: {item.commentsCount} • Fichiers: {item.filesCount}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={{ marginTop: 16 }}>
        <UpcomingEventsPanel
          items={upcomingItems}
          loading={upcomingLoading}
          onPressItem={(id) =>
            router.push({ pathname: "/events/[id]", params: { id } })
          }
        />
      </View>
      </ScrollView>
    </View>
  );
}
