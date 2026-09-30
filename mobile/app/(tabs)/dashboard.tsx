import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { api, ApiError } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import type { DashboardStatsDto } from "../../src/lib/types";
import { formatEventRange } from "../../src/lib/date";
import { colorForTheme } from "../../src/lib/theme";
import { AuthImage } from "../../components/auth-image";
import { roleLabel } from "../../src/lib/roles";

export default function DashboardScreen() {
  const router = useRouter();
  const { me } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardStatsDto | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    setError(null);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get<DashboardStatsDto>("/stats/dashboard");
      setData(res);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharge à chaque fois que l'onglet reprend le focus, pas seulement au montage.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ color: "red" }}>{error ?? "Erreur inconnue"}</Text>
        <Pressable
          onPress={() => load()}
          style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
        >
          <Text>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  const firstName = me?.user.name?.split(" ")[0] ?? null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
      }
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "700" }}>
          {firstName ? `Bonjour ${firstName}` : "Bonjour"}
        </Text>
        <Pressable
          onPress={() => router.push("/profile")}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 }}
        >
          <Text>Profil</Text>
        </Pressable>
      </View>

      {/* Upcoming events */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Prochains événements</Text>

        {data.upcomingEvents.length === 0 ? (
          <View style={{ padding: 16, borderRadius: 14, borderWidth: 1 }}>
            <Text style={{ opacity: 0.6 }}>Aucun événement à venir</Text>
          </View>
        ) : (
          data.upcomingEvents.map((e) => {
            const eventColor = colorForTheme(e.theme);
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push({ pathname: "/events/[id]", params: { id: e.id } })}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderLeftWidth: 8,
                  borderLeftColor: eventColor,
                }}
              >
                <Text style={{ fontWeight: "600" }}>{e.title}</Text>
                <Text style={{ opacity: 0.65, marginTop: 2 }}>
                  {formatEventRange(e.startDateTime, e.endDateTime)}
                </Text>
                <Text style={{ opacity: 0.55, fontSize: 12, marginTop: 2 }}>
                  {e.calendarName}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Calendars + activity */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Mes calendriers</Text>

        {data.calendars.length === 0 ? (
          <View style={{ padding: 16, borderRadius: 14, borderWidth: 1 }}>
            <Text style={{ opacity: 0.6 }}>Aucun calendrier</Text>
          </View>
        ) : (
          data.calendars.map((c) => {
            const color = colorForTheme(c.theme);
            const hasCover = c.isPremium && !!c.coverImageUrl;
            const textColor = hasCover ? "#fff" : undefined;
            const dimTextColor = hasCover ? "rgba(255,255,255,0.85)" : undefined;
            const boxBg = hasCover ? "rgba(255,255,255,0.16)" : "rgba(127,127,127,0.12)";

            return (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: "/calendars/[id]", params: { id: c.id } })}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  overflow: "hidden",
                }}
              >
                {hasCover ? (
                  <>
                    <AuthImage
                      uri={c.coverImageUrl!}
                      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.45)",
                      }}
                    />
                    <View style={{ padding: 14, paddingBottom: 6 }}>
                      <Text style={{ fontWeight: "700", fontSize: 15, color: textColor }}>
                        {c.name}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View
                    style={{
                      backgroundColor: color,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Text style={{ fontWeight: "700", fontSize: 15, color: "white" }} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </View>
                )}

                <View style={{ padding: 14, paddingTop: hasCover ? 0 : 14, gap: 6 }}>
                  <Text style={{ opacity: hasCover ? 1 : 0.65, fontSize: 12, color: dimTextColor }}>
                    {roleLabel(c.role)} • {c.membersCount} membre{c.membersCount > 1 ? "s" : ""} •{" "}
                    {c.eventsCount} événement{c.eventsCount > 1 ? "s" : ""}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: boxBg }}>
                      <Text style={{ fontSize: 11, opacity: hasCover ? 1 : 0.6, color: dimTextColor }}>
                        7 derniers jours
                      </Text>
                      <Text style={{ fontWeight: "600", color: textColor }}>
                        {c.activity.last7d.eventsCreated} événements
                      </Text>
                      <Text style={{ fontSize: 12, opacity: hasCover ? 1 : 0.75, color: dimTextColor }}>
                        {c.activity.last7d.comments} commentaires • {c.activity.last7d.files} fichiers
                      </Text>
                    </View>
                    <View style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: boxBg }}>
                      <Text style={{ fontSize: 11, opacity: hasCover ? 1 : 0.6, color: dimTextColor }}>
                        30 derniers jours
                      </Text>
                      <Text style={{ fontWeight: "600", color: textColor }}>
                        {c.activity.last30d.eventsCreated} événements
                      </Text>
                      <Text style={{ fontSize: 12, opacity: hasCover ? 1 : 0.75, color: dimTextColor }}>
                        {c.activity.last30d.comments} commentaires • {c.activity.last30d.files} fichiers
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
