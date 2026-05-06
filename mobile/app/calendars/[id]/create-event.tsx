import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";

export default function CreateEventScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // MVP: on tape des ISO strings (on fera un date picker ensuite)
  const [startDateTime, setStartDateTime] = useState("2026-03-28T16:50:00.000Z");
  const [endDateTime, setEndDateTime] = useState("2026-03-28T17:50:00.000Z");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!calendarId) return;

    const t = title.trim();
    if (!t) {
      setError("Le titre est requis");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post(`/calendars/${calendarId}/events`, {
        title: t,
        description: description.trim() ? description.trim() : null,
        location: location.trim() ? location.trim() : null,
        startDateTime,
        endDateTime,
      });

      // Retour sur la liste d'événements du calendrier
      router.replace({ pathname: "/calendars/[id]/events", params: { id: calendarId } });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "Créer un événement" }} />

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
        onPress={onCreate}
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text>{loading ? "Création..." : "Créer"}</Text>
      </Pressable>
    </View>
  );
}
