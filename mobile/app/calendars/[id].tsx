import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { api, ApiError } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { formatEventRange } from "../../src/lib/date";
import { FREE_THEMES, PREMIUM_THEMES, THEME_COLORS, colorForTheme } from "../../src/lib/theme";
import { CalendarColorBar } from "../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../components/home-header-button";
import { AuthImage } from "../../components/auth-image";
import { BRAND } from "../../src/lib/colors";
import { roleLabel } from "../../src/lib/roles";

type CalendarHomeResponse = {
  calendar: {
    id: string;
    name: string;
    color: string;
    theme: string;
    coverImageUrl: string | null;
    isPremium: boolean;
    publicIcsEnabled: boolean;
    role: string;
  };
  members: {
    total: number;
    premiumSeats: number | null;
  };
  upcomingEvents: Array<{
    id: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
  }>;
  activity: {
    last7d: { events: number; comments: number; files: number };
    last30d: { events: number; comments: number; files: number };
  };
  integrations: {
    google: { enabled: boolean; syncMode: "MANUAL" };
  };
  permissions: {
    canEdit: boolean;
    canInvite: boolean;
    canManagePremium: boolean;
  };
};

export default function CalendarHomeScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;

  // Expo Router peut donner string | string[]
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { me } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CalendarHomeResponse | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError("ID calendrier manquant");
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const res = await api.get<CalendarHomeResponse>(`/calendars/${id}/home`);
      setData(res);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Recharge à chaque fois que l'écran reprend le focus (ex: retour après
  // avoir modifié l'image de couverture), pas seulement au montage.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function chooseMyTheme(t: string) {
    if (!id) return;
    setThemeError(null);
    setSavingTheme(true);
    try {
      await api.patch(`/calendars/${id}/my-theme`, { theme: t });
      await load();
    } catch (e: any) {
      setThemeError(e instanceof ApiError ? e.message : "Erreur inconnue");
    } finally {
      setSavingTheme(false);
    }
  }

  const name = data?.calendar.name;
  const theme = data?.calendar.theme;
  const color = colorForTheme(theme);
  const subParams = { id, name: name ?? "", theme: theme ?? "" };
  const hasPremium = !!data?.calendar.isPremium || !!me?.user.isPremium;
  const availableThemes = hasPremium
    ? [...FREE_THEMES, ...PREMIUM_THEMES]
    : FREE_THEMES;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: name ?? "Calendrier",
          headerShown: true,
          headerTintColor: color || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
        }}
      />
      <CalendarColorBar color={color} />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={load}
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
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {data?.calendar.coverImageUrl ? (
            <AuthImage
              uri={data.calendar.coverImageUrl}
              style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 4 }}
            />
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: color || BRAND,
              }}
            />
            <Text style={{ fontSize: 18, fontWeight: "600" }}>{name}</Text>
          </View>
          <Text>Rôle: {data?.calendar.role ? roleLabel(data.calendar.role) : ""}</Text>
          <Text>Membres: {data?.members.total}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text>Premium: {data?.calendar.isPremium ? "Oui" : "Non"}</Text>
            {!data?.calendar.isPremium && data?.permissions.canManagePremium ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/premium", params: { calendarId: id } })
                }
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600" }}>Passer premium ✨</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={{ marginTop: 8, fontWeight: "600" }}>
            Ma couleur pour ce calendrier
          </Text>
          <Text style={{ opacity: 0.6, fontSize: 12 }}>
            Personnel — les autres membres peuvent choisir une couleur différente.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {availableThemes.map((t) => (
              <Pressable
                key={t}
                onPress={() => chooseMyTheme(t)}
                disabled={savingTheme}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: theme === t ? 2 : 1,
                  opacity: savingTheme ? 0.6 : 1,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: THEME_COLORS[t],
                  }}
                />
                <Text>
                  {t}
                  {(PREMIUM_THEMES as readonly string[]).includes(t) ? " ✨" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
          {!hasPremium ? (
            <Pressable
              onPress={() => router.push({ pathname: "/premium", params: { calendarId: id } })}
            >
              <Text style={{ opacity: 0.6, fontSize: 12, textDecorationLine: "underline" }}>
                Plus de couleurs disponibles en passant toi-même ou ce calendrier en premium ✨
              </Text>
            </Pressable>
          ) : null}
          {themeError ? <Text style={{ color: "red" }}>{themeError}</Text> : null}

          <Text style={{ marginTop: 8, fontWeight: "600" }}>
            Prochains événements
          </Text>
          {(data?.upcomingEvents ?? []).length === 0 ? (
            <Text style={{ opacity: 0.6 }}>Aucun événement à venir</Text>
          ) : (
            (data?.upcomingEvents ?? []).map((ev) => (
              <View key={ev.id} style={{ paddingVertical: 6 }}>
                <Text style={{ fontWeight: "500" }}>{ev.title}</Text>
                <Text style={{ opacity: 0.7 }}>
                  {formatEventRange(ev.startDateTime, ev.endDateTime)}
                </Text>
              </View>
            ))
          )}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendars/[id]/events",
                params: subParams,
              })
            }
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              borderColor: color || undefined,
              marginTop: 8,
            }}
          >
            <Text>Voir tous les événements</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendars/[id]/ics",
                params: subParams,
              })
            }
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              marginTop: 8,
            }}
          >
            <Text>ICS public</Text>
          </Pressable>

          {data?.permissions.canInvite ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/calendars/[id]/invite",
                  params: subParams,
                })
              }
              style={{
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                marginTop: 8,
              }}
            >
              <Text>Inviter un membre</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendars/[id]/members",
                params: subParams,
              })
            }
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              marginTop: 8,
            }}
          >
            <Text>Membres</Text>
          </Pressable>

          {data?.permissions.canEdit ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/calendars/[id]/edit",
                  params: subParams,
                })
              }
              style={{
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                marginTop: 8,
              }}
            >
              <Text>Modifier le calendrier</Text>
            </Pressable>
          ) : null}

          {data?.calendar.role === "owner" || data?.calendar.role === "admin" ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/calendars/[id]/stats",
                  params: subParams,
                })
              }
              style={{
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                marginTop: 8,
              }}
            >
              <Text>Statistiques</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
