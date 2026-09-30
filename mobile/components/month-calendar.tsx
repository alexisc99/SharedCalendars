import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, PanResponder } from "react-native";
import { Text } from "./themed/text";
import { View } from "./themed/view";
import { Pressable } from "./themed/pressable";
import {
  addMonths,
  endOfMonth,
  formatMonthYear,
  isSameDay,
  startOfMonth,
  toDateKey,
} from "../src/lib/date";
import { BRAND } from "../src/lib/colors";

export type MonthCalendarEvent = {
  id: string;
  title: string;
  startDateTime: string;
  color?: string | null;
};

type Props = {
  month: Date;
  onMonthChange: (next: Date) => void;
  events: MonthCalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  accentColor?: string | null;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MAX_VISIBLE_CHIPS = 2;

function buildGridDays(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  // Lundi = 0 ... Dimanche = 6
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = endOfMonth(month).getDate();

  const days: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function MonthCalendar({
  month,
  onMonthChange,
  events,
  selectedDate,
  onSelectDate,
  accentColor,
}: Props) {
  const days = useMemo(() => buildGridDays(month), [month]);
  const accent = accentColor || BRAND;

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MonthCalendarEvent[]>();
    for (const e of events) {
      const key = toDateKey(new Date(e.startDateTime));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const today = new Date();

  // Ref plutôt que dépendances de useMemo : le PanResponder n'est créé
  // qu'une fois, mais lit toujours le mois/callback les plus récents.
  const latest = useRef({ month, onMonthChange });
  latest.current = { month, onMonthChange };

  const panResponder = useRef(
    PanResponder.create({
      // Ne capte le geste que s'il est nettement plus horizontal que
      // vertical — sinon le scroll vertical du parent (ScrollView) se
      // retrouve bloqué au moindre effleurement.
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_, gesture) => {
        const { month: currentMonth, onMonthChange: setMonth } = latest.current;
        if (gesture.dx <= -40) setMonth(addMonths(currentMonth, 1));
        else if (gesture.dx >= 40) setMonth(addMonths(currentMonth, -1));
      },
    }),
  ).current;

  // Glissement animé du mois affiché : la grille (en-tête des jours de la
  // semaine + cases) coulisse depuis la droite en avançant, depuis la
  // gauche en reculant — que le changement vienne du swipe ou des flèches.
  const slide = useRef(new Animated.Value(0)).current;
  const monthKeyRef = useRef(month.getFullYear() * 12 + month.getMonth());

  useEffect(() => {
    const nextKey = month.getFullYear() * 12 + month.getMonth();
    const prevKey = monthKeyRef.current;
    if (nextKey !== prevKey) {
      const forward = nextKey > prevKey;
      slide.setValue(forward ? 60 : -60);
      Animated.timing(slide, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    monthKeyRef.current = nextKey;
  }, [month, slide]);

  return (
    <View style={{ gap: 8 }} {...panResponder.panHandlers}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: accent,
          borderRadius: 14,
          paddingVertical: 6,
          paddingHorizontal: 4,
        }}
      >
        <Pressable
          onPress={() => onMonthChange(addMonths(month, -1))}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 20, color: "white", fontWeight: "600" }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "white" }}>
          {formatMonthYear(month)}
        </Text>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, 1))}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 20, color: "white", fontWeight: "600" }}>›</Text>
        </Pressable>
      </View>

      <Animated.View
        style={{
          overflow: "hidden",
          gap: 8,
          transform: [{ translateX: slide }],
          opacity: slide.interpolate({
            inputRange: [-60, 0, 60],
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          }),
        }}
      >
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: "14.28%", alignItems: "center" }}>
            <Text style={{ fontSize: 12, opacity: 0.6 }}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day, i) => {
          if (!day) {
            return <View key={i} style={{ width: "14.28%", minHeight: 82 }} />;
          }
          const key = toDateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const visible = dayEvents.slice(0, MAX_VISIBLE_CHIPS);
          const overflow = dayEvents.length - visible.length;
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          return (
            <Pressable
              key={i}
              onPress={() => onSelectDate(day)}
              style={{
                width: "14.28%",
                minHeight: 82,
                paddingVertical: 3,
                paddingHorizontal: 2,
                gap: 2,
                borderRadius: 8,
                backgroundColor: isSelected ? `${accent}1A` : undefined,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "center",
                  backgroundColor: isSelected ? accent : undefined,
                  borderWidth: !isSelected && isToday ? 1.5 : 0,
                  borderColor: isToday ? accent : undefined,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isToday || isSelected ? "700" : "400",
                    color: isSelected ? "white" : isToday ? accent : undefined,
                  }}
                >
                  {day.getDate()}
                </Text>
              </View>

              <View style={{ gap: 2 }}>
                {visible.map((e) => {
                  const c = e.color || BRAND;
                  return (
                    <View
                      key={e.id}
                      style={{
                        backgroundColor: `${c}26`,
                        borderRadius: 4,
                        paddingHorizontal: 3,
                        paddingVertical: 1,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 9, color: c, fontWeight: "600" }}
                      >
                        {e.title}
                      </Text>
                    </View>
                  );
                })}
                {overflow > 0 ? (
                  <Text style={{ fontSize: 9, opacity: 0.6, textAlign: "center" }}>
                    +{overflow}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}
