import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import type { EventDetail } from "../../../src/lib/types";
import { DateTimeField } from "../../../components/date-time-field";
import { HomeHeaderButton } from "../../../components/home-header-button";

export default function EditEventScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDateTime, setStartDateTime] = useState<Date>(new Date());
  const [endDateTime, setEndDateTime] = useState<Date>(new Date());
  const [isPast, setIsPast] = useState(false);

  async function load() {
    if (!id) return;
    setError(null);
    setLoading(true);

    try {
      const res = await api.get<EventDetail>(`/events/${id}/detail`);
      setTitle(res.title ?? "");
      setDescription(res.description ?? "");
      setLocation(res.location ?? "");
      setStartDateTime(new Date(res.startDateTime));
      setEndDateTime(new Date(res.endDateTime));
      setIsPast(new Date(res.endDateTime).getTime() < Date.now());
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!id) return;

    const t = title.trim();
    if (!t) {
      setError("Le titre est requis");
      return;
    }

    if (!isPast && endDateTime <= startDateTime) {
      setError("La fin doit être après le début");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        title: t,
        description: description.trim() ? description.trim() : null,
      };
      // Un événement passé ne peut plus changer d'heure ni de lieu (règle backend).
      if (!isPast) {
        body.location = location.trim() ? location.trim() : null;
        body.startDateTime = startDateTime.toISOString();
        body.endDateTime = endDateTime.toISOString();
      }

      await api.patch(`/events/${id}`, body);

      // retour sur le détail
      router.replace({ pathname: "/events/[id]", params: { id } });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Stack.Screen
        options={{
          title: "Modifier l'événement",
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
        <>
          {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

          <Text>Titre *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
          />

          <Text>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ borderWidth: 1, padding: 10, borderRadius: 10, minHeight: 80 }}
          />

          {isPast ? (
            <Text style={{ opacity: 0.6, fontStyle: "italic" }}>
              Événement terminé — l'heure et le lieu ne sont plus modifiables
            </Text>
          ) : null}

          <Text>Lieu</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            editable={!isPast}
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 10,
              opacity: isPast ? 0.5 : 1,
            }}
          />

          <DateTimeField
            label="Début"
            value={startDateTime}
            onChange={setStartDateTime}
            disabled={isPast}
          />
          <DateTimeField
            label="Fin"
            value={endDateTime}
            onChange={setEndDateTime}
            minimumDate={startDateTime}
            disabled={isPast}
          />

          <Pressable
            onPress={save}
            disabled={saving}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text>{saving ? "Sauvegarde..." : "Sauvegarder"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
