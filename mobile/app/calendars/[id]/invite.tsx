import React, { useEffect, useState } from "react";
import { Share, ActivityIndicator, Alert } from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { api, ApiError } from "../../../src/lib/api";
import { colorForTheme } from "../../../src/lib/theme";
import { formatDateTime } from "../../../src/lib/date";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";

type InvitationLink = {
  id: string;
  calendarId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

type InvitationResponse = {
  success: boolean;
  id: string;
  data: InvitationLink;
};

export default function InviteScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const nameRaw = params.name;
  const calendarName = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
  const themeRaw = params.theme;
  const calendarTheme = Array.isArray(themeRaw) ? themeRaw[0] : themeRaw;
  const calendarColor = colorForTheme(calendarTheme);

  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const [links, setLinks] = useState<InvitationLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLinks() {
    if (!id) return;
    setLoadingLinks(true);
    try {
      const res = await api.get<InvitationLink[]>(`/calendars/${id}/invitations`);
      setLinks(res);
    } catch {
      // pas bloquant : l'écran reste utilisable pour en générer un nouveau
    } finally {
      setLoadingLinks(false);
    }
  }

  useEffect(() => {
    loadLinks();
  }, [id]);

  async function generate() {
    if (!id) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await api.post<InvitationResponse>(`/calendars/${id}/invitations`);
      setLinks((prev) => [res.data, ...prev]);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e?.message ?? "Erreur inconnue");
    } finally {
      setGenerating(false);
    }
  }

  function revoke(link: InvitationLink) {
    Alert.alert(
      "Révoquer ce lien",
      "Il ne pourra plus être utilisé pour rejoindre le calendrier.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Révoquer",
          style: "destructive",
          onPress: async () => {
            setRevokingId(link.id);
            try {
              await api.del(`/calendars/${id}/invitations/${link.id}`);
              setLinks((prev) => prev.filter((l) => l.id !== link.id));
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e instanceof ApiError ? e.message : "La révocation a échoué",
              );
            } finally {
              setRevokingId(null);
            }
          },
        },
      ],
    );
  }

  async function share(token: string) {
    try {
      await Share.share({
        message: `Rejoins mon calendrier MyApp : ${token}`,
      });
    } catch {
      // ignore
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · Inviter` : "Inviter",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ opacity: 0.7 }}>
          Génère un lien d'invitation valable 7 jours, réutilisable par tout le monde à qui tu
          l'envoies (un groupe WhatsApp entier peut rejoindre avec un seul lien).
        </Text>

        <Pressable
          onPress={generate}
          disabled={generating}
          style={{
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? <ActivityIndicator /> : <Text>Générer un nouveau lien</Text>}
        </Pressable>

        {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

        <Text style={{ fontWeight: "600", marginTop: 8 }}>Liens actifs</Text>

        {loadingLinks ? (
          <ActivityIndicator />
        ) : links.length === 0 ? (
          <Text style={{ opacity: 0.6 }}>Aucun lien actif pour l'instant</Text>
        ) : (
          links.map((link) => {
            const isBusy = revokingId === link.id;
            return (
              <View
                key={link.id}
                style={{ padding: 12, borderRadius: 10, borderWidth: 1, gap: 6, opacity: isBusy ? 0.5 : 1 }}
              >
                <Text selectable style={{ fontFamily: "Courier", fontSize: 12 }}>
                  {link.token}
                </Text>
                <Text style={{ opacity: 0.6, fontSize: 12 }}>
                  Expire le {formatDateTime(link.expiresAt)}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => share(link.token)}
                    disabled={isBusy}
                    style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1 }}
                  >
                    <Text>Partager</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => revoke(link)}
                    disabled={isBusy}
                    style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1 }}
                  >
                    <Text style={{ color: "red" }}>Révoquer</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
