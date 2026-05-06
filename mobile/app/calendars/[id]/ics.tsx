import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";
import { API_BASE_URL } from "@/src/config/env";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  async function loadState() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      // On s'appuie sur /home pour connaître enabled
      const res = await api.get<any>(`/calendars/${calendarId}/home`);
      setEnabled(!!res?.calendar?.publicIcsEnabled);
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: "ICS public" }} />
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
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "ICS public" }} />

      <Text style={{ fontSize: 16, fontWeight: "600" }}>Lien ICS public</Text>
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
  );
}
