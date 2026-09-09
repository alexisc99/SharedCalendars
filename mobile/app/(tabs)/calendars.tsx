import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { api, ApiError } from "../../src/lib/api";
import { MonthCalendar, MonthCalendarEvent } from "../../components/month-calendar";
import { UpcomingEventsPanel, UpcomingEventItem } from "../../components/upcoming-events-panel";
import {
  endOfMonth,
  formatDate,
  formatEventRange,
  isSameDay,
  startOfMonth,
} from "../../src/lib/date";
import { colorForTheme } from "../../src/lib/theme";

type FeedItem = {
  id: string;
  calendar: { id: string; name: string; color: string | null; theme: string | null };
  title: string;
  startDateTime: string;
  endDateTime: string;
  status: string;
};

type FeedResponse = { items: FeedItem[]; nextCursor: string | null };

export default function CalendarsScreen() {
  const router = useRouter();

  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [monthEvents, setMonthEvents] = useState<FeedItem[]>([]);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [upcoming, setUpcoming] = useState<FeedItem[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  const loadMonth = useCallback(async () => {
    setMonthError(null);
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      const res = await api.get<FeedResponse>(
        `/events/feed?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=200`,
      );
      setMonthEvents(res.items);
    } catch (e: any) {
      if (e instanceof ApiError) setMonthError(e.message);
      else setMonthError("Erreur inconnue");
    }
  }, [month]);

  const loadUpcoming = useCallback(async () => {
    setUpcomingLoading(true);
    try {
      const from = new Date().toISOString();
      const res = await api.get<FeedResponse>(
        `/events/feed?from=${encodeURIComponent(from)}&limit=20`,
      );
      setUpcoming(res.items);
    } catch {
      // le panneau affichera juste une liste vide en cas d'erreur silencieuse
    } finally {
      setUpcomingLoading(false);
    }
  }, []);

  // Recharge à chaque fois que l'onglet reprend le focus (ex: retour après
  // avoir créé un événement sur un autre calendrier), pas seulement au montage.
  useFocusEffect(
    useCallback(() => {
      loadMonth();
      loadUpcoming();
    }, [loadMonth, loadUpcoming]),
  );

  const calendarEvents: MonthCalendarEvent[] = useMemo(
    () =>
      monthEvents.map((e) => ({
        id: e.id,
        startDateTime: e.startDateTime,
        color: colorForTheme(e.calendar.theme),
      })),
    [monthEvents],
  );

  const dayEvents = useMemo(
    () =>
      monthEvents.filter((e) => isSameDay(new Date(e.startDateTime), selectedDate)),
    [monthEvents, selectedDate],
  );

  const upcomingItems: UpcomingEventItem[] = useMemo(
    () =>
      upcoming.map((e) => ({
        id: e.id,
        title: e.title,
        startDateTime: e.startDateTime,
        endDateTime: e.endDateTime,
        color: colorForTheme(e.calendar.theme),
        subtitle: e.calendar.name,
      })),
    [upcoming],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
        Calendrier principal
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Pressable
          onPress={() => router.push("/calendars/manage")}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
          }}
        >
          <Text>Mes calendriers</Text>
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
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  backgroundColor: colorForTheme(item.calendar.theme),
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600" }}>{item.title}</Text>
                <Text style={{ opacity: 0.7 }}>
                  {formatEventRange(item.startDateTime, item.endDateTime)}
                </Text>
                <Text style={{ opacity: 0.6, fontSize: 12 }}>
                  {item.calendar.name}
                </Text>
              </View>
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
  );
}
