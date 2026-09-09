import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { formatEventRange } from "../src/lib/date";

export type UpcomingEventItem = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  color?: string | null;
  subtitle?: string | null;
};

type Props = {
  items: UpcomingEventItem[];
  loading: boolean;
  onPressItem: (id: string) => void;
  defaultExpanded?: boolean;
};

export function UpcomingEventsPanel({
  items,
  loading,
  onPressItem,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={{ borderWidth: 1, borderRadius: 12, overflow: "hidden" }}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 12,
        }}
      >
        <Text style={{ fontWeight: "600" }}>Événements à venir</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {loading ? <ActivityIndicator size="small" /> : null}
          <Text style={{ fontSize: 16 }}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {items.length === 0 && !loading ? (
            <Text style={{ opacity: 0.6 }}>Aucun événement à venir</Text>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onPressItem(item.id)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 6,
                    backgroundColor: item.color || "#4f46e5",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600" }}>{item.title}</Text>
                  <Text style={{ opacity: 0.7 }}>
                    {formatEventRange(item.startDateTime, item.endDateTime)}
                  </Text>
                  {item.subtitle ? (
                    <Text style={{ opacity: 0.6, fontSize: 12 }}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
