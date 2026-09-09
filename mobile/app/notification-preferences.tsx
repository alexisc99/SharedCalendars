import React, { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../src/lib/api";
import { HomeHeaderButton } from "../components/home-header-button";

// Types de notification réellement filtrables (celles créées via
// NotificationsService.notifyUsers) — les notifications système liées au
// compte/plan (expiration, etc.) sont envoyées directement et ne passent pas
// par ces préférences, donc pas de sens de les proposer ici.
const TYPES: { type: string; label: string }[] = [
  { type: "EVENT_PUBLISHED", label: "Nouveaux événements" },
  { type: "EVENT_PENDING", label: "Événements en attente de publication" },
  { type: "EVENT_REJECTED", label: "Événements rejetés" },
  { type: "EVENT_REMINDER", label: "Rappels d'événements" },
  { type: "COMMENT_ADDED", label: "Nouveaux commentaires" },
  { type: "POLL_FINALIZED", label: "Sondages finalisés" },
];

type PreferenceRow = { type: string; enabled: boolean };

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // type en cours de sauvegarde
  // Par défaut activé tant qu'aucune préférence explicite n'existe (même
  // logique que isNotificationEnabled() côté backend).
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(TYPES.map((t) => [t.type, true])),
  );

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<PreferenceRow[]>("/notifications/preferences");
      setEnabled((prev) => {
        const next = { ...prev };
        for (const row of res) next[row.type] = row.enabled;
        return next;
      });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(type: string, value: boolean) {
    const previous = enabled[type];
    setEnabled((prev) => ({ ...prev, [type]: value }));
    setSaving(type);
    try {
      await api.put("/notifications/preferences", {
        preferences: [{ type, enabled: value }],
      });
    } catch (e: any) {
      // rollback si l'enregistrement échoue
      setEnabled((prev) => ({ ...prev, [type]: previous }));
      setError(e instanceof ApiError ? e.message : "Erreur inconnue");
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Préférences de notifications",
          headerShown: true,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
          <Text style={{ opacity: 0.6, fontSize: 12 }}>
            Ces réglages s'appliquent aux notifications dans l'app, sur cet appareil comme sur les autres.
          </Text>

          {TYPES.map((t) => (
            <View
              key={t.type}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                opacity: saving === t.type ? 0.6 : 1,
              }}
            >
              <Text style={{ flex: 1, marginRight: 12 }}>{t.label}</Text>
              <Switch
                value={enabled[t.type]}
                onValueChange={(v) => toggle(t.type, v)}
                disabled={saving === t.type}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
