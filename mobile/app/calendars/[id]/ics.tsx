import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// SDK 54 : ancienne API (cacheDirectory + downloadAsync avec en-têtes) via "/legacy".
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { api, ApiError } from "../../../src/lib/api";
import { API_BASE_URL } from "@/src/config/env";
import { getToken } from "../../../src/lib/authToken";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";

function buildIcsUrl(token: string): string {
  return `${API_BASE_URL}/public/calendars/${token}/ics`;
}
type IcsResponse = {
  success?: boolean;
  data?: {
    publicIcsEnabled?: boolean;
    publicIcsToken?: string | null;
  };
};

function extractToken(res: unknown): string | null {
  const r = res as IcsResponse;
  const token = r?.data?.publicIcsToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function extractEnabled(res: unknown): boolean | null {
  const r = res as IcsResponse;
  const enabled = r?.data?.publicIcsEnabled;
  return typeof enabled === "boolean" ? enabled : null;
}

export default function CalendarIcsScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [calendarName, setCalendarName] = useState<string | null>(null);
  const [calendarColor, setCalendarColor] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"ics" | "csv" | null>(null);

  async function exportFile(format: "ics" | "csv") {
    if (!calendarId) return;
    setExporting(format);
    try {
      const token = await getToken();
      const filename = `calendrier-${calendarId}.${format}`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const result = await FileSystem.downloadAsync(
        `${API_BASE_URL}/exports/calendar/${calendarId}/${format}`,
        localUri,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Indisponible", "Le partage n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: format === "ics" ? "text/calendar" : "text/csv",
      });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "L'export a échoué");
    } finally {
      setExporting(null);
    }
  }

  async function loadState() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      // On s'appuie sur /home pour connaître enabled
      const res = await api.get<any>(`/calendars/${calendarId}/home`);
      setEnabled(!!res?.calendar?.publicIcsEnabled);
      setCalendarName(res?.calendar?.name ?? null);
      setCalendarColor(colorForTheme(res?.calendar?.theme ?? null));
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function enable() {
    if (!calendarId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<IcsResponse>(
        `/calendars/${calendarId}/public-ics/enable`,
        {},
      );
      const enabled = extractEnabled(res);
      if (enabled !== null) setEnabled(enabled);

      const token = extractToken(res);
      if (token) setIcsUrl(buildIcsUrl(token));
      await loadState();
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!calendarId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<any>(
        `/calendars/${calendarId}/public-ics/rotate`,
        {},
      );
      const token = extractToken(res);
      if (token) setIcsUrl(buildIcsUrl(token));
      await loadState();
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!calendarId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<any>(`/calendars/${calendarId}/public-ics/disable`, {});
      setEnabled(false);
      setIcsUrl(null);
      await loadState();
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadState();
  }, [calendarId]);

  const statusLabel = useMemo(
    () => (enabled ? "Activé" : "Désactivé"),
    [enabled],
  );

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: "ICS public",
            headerShown: true,
            headerRight: () => <HomeHeaderButton />,
          }}
        />
        <CalendarColorBar color={calendarColor ?? colorForTheme(null)} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: "ICS public",
            headerShown: true,
            headerRight: () => <HomeHeaderButton />,
            contentStyle: { paddingBottom: insets.bottom },
          }}
        />
        <CalendarColorBar color={calendarColor ?? colorForTheme(null)} />
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable
            onPress={loadState}
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · ICS public` : "ICS public",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor ?? colorForTheme(null)} />

      <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: "600" }}>Exporter ce calendrier</Text>
      <Text style={{ opacity: 0.7, fontSize: 12 }}>
        Télécharge une copie ponctuelle de tes événements (contrairement au lien ICS public ci-dessous, qui reste à jour automatiquement).
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => exportFile("ics")}
          disabled={exporting !== null}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            opacity: exporting !== null ? 0.6 : 1,
          }}
        >
          {exporting === "ics" ? <ActivityIndicator /> : <Text>Exporter .ics</Text>}
        </Pressable>
        <Pressable
          onPress={() => exportFile("csv")}
          disabled={exporting !== null}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            opacity: exporting !== null ? 0.6 : 1,
          }}
        >
          {exporting === "csv" ? <ActivityIndicator /> : <Text>Exporter .csv</Text>}
        </Pressable>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "600", marginTop: 12 }}>Lien ICS public</Text>
      <Text>Statut: {statusLabel}</Text>

      {icsUrl ? (
        <View style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
          <Text style={{ fontWeight: "600" }}>URL ICS</Text>
          <Text selectable>{icsUrl}</Text>
          <Text style={{ opacity: 0.7, marginTop: 6 }}>
            Partage ce lien en lecture seule. (Ne le mets pas dans les logs)
          </Text>
        </View>
      ) : enabled ? (
        <Text style={{ opacity: 0.7 }}>
          L’URL n’est pas affichée tant qu’elle n’a pas été générée/rotée dans
          cet écran.
        </Text>
      ) : null}

      {!enabled ? (
        <Pressable
          onPress={enable}
          disabled={busy}
          style={{
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text>{busy ? "Activation..." : "Activer l’ICS public"}</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={rotate}
            disabled={busy}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text>{busy ? "Rotation..." : "Rotater le lien ICS"}</Text>
          </Pressable>

          <Pressable
            onPress={disable}
            disabled={busy}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "red" }}>
              {busy ? "Désactivation..." : "Désactiver"}
            </Text>
          </Pressable>
        </>
      )}
      </View>
    </View>
  );
}
