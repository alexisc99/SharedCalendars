import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import {
  addMonths,
  endOfMonth,
  formatMonthYear,
  isSameDay,
  startOfMonth,
  toDateKey,
} from "../src/lib/date";

export type MonthCalendarEvent = {
  id: string;
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
const DEFAULT_DOT_COLOR = "#4f46e5";

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

  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of events) {
      const key = toDateKey(new Date(e.startDateTime));
      const colors = map.get(key) ?? [];
      colors.push(e.color ?? DEFAULT_DOT_COLOR);
      map.set(key, colors);
    }
    return map;
  }, [events]);

  const today = new Date();

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => onMonthChange(addMonths(month, -1))}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 20, color: accentColor || undefined }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "600", color: accentColor || undefined }}>
          {formatMonthYear(month)}
        </Text>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, 1))}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 20, color: accentColor || undefined }}>›</Text>
        </Pressable>
      </View>

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
            return (
              <View key={i} style={{ width: "14.28%", aspectRatio: 1 }} />
            );
          }
          const key = toDateKey(day);
          const dots = dotsByDay.get(key) ?? [];
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          return (
            <Pressable
              key={i}
              onPress={() => onSelectDate(day)}
              style={{
                width: "14.28%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                  borderColor: (isSelected || isToday) && accentColor
                    ? accentColor
                    : undefined,
                }}
              >
                <Text style={{ fontSize: 14 }}>{day.getDate()}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                {dots.slice(0, 3).map((c, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: c,
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
