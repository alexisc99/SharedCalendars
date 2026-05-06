import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";
import type { EventDetail } from "../../../src/lib/types";

export default function EditEventScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");

  async function load() {
    if (!id) return;
    setError(null);
    setLoading(true);

    try {
      const res = await api.get<EventDetail>(`/events/${id}/detail`);
      setTitle(res.title ?? "");
      setDescription(res.description ?? "");
      setLocation(res.location ?? "");
      setStartDateTime(res.startDateTime);
      setEndDateTime(res.endDateTime);
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

    setError(null);
    setSaving(true);

    try {
      await api.patch(`/events/${id}`, {
        title: t,
        description: description.trim() ? description.trim() : null,
        location: location.trim() ? location.trim() : null,
        startDateTime,
        endDateTime,
      });

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
      <Stack.Screen options={{ title: "Modifier l'événement" }} />

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

          <Text>Lieu</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
          />

          <Text>StartDateTime (ISO UTC)</Text>
          <TextInput
            value={startDateTime}
            onChangeText={setStartDateTime}
            autoCapitalize="none"
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
          />

          <Text>EndDateTime (ISO UTC)</Text>
          <TextInput
            value={endDateTime}
            onChangeText={setEndDateTime}
            autoCapitalize="none"
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
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
