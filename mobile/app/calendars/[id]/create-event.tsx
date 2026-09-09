import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "../../../src/lib/api";
import { DateTimeField } from "../../../components/date-time-field";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function defaultEnd(start: Date): Date {
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function CreateEventScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const nameRaw = params.name;
  const calendarName = Array.isArray(nameRaw) ? nameRaw[0] : nameRaw;
  const themeRaw = params.theme;
  const calendarTheme = Array.isArray(themeRaw) ? themeRaw[0] : themeRaw;
  const calendarColor = colorForTheme(calendarTheme);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [startDateTime, setStartDateTime] = useState<Date>(defaultStart);
  const [endDateTime, setEndDateTime] = useState<Date>(() => defaultEnd(defaultStart()));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChangeStart(next: Date) {
    setStartDateTime(next);
    if (endDateTime <= next) {
      setEndDateTime(defaultEnd(next));
    }
  }

  async function onCreate() {
    if (!calendarId) return;

    const t = title.trim();
    if (!t) {
      setError("Le titre est requis");
      return;
    }

    if (endDateTime <= startDateTime) {
      setError("La fin doit être après le début");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await api.post(`/calendars/${calendarId}/events`, {
        title: t,
        description: description.trim() ? description.trim() : null,
        location: location.trim() ? location.trim() : null,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      });

      // Retour sur la liste d'événements du calendrier
      router.replace({
        pathname: "/calendars/[id]/events",
        params: { id: calendarId, name: calendarName ?? "", theme: calendarTheme ?? "" },
      });
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendarName ? `${calendarName} · Créer un événement` : "Créer un événement",
          headerShown: true,
          headerTintColor: calendarColor || undefined,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />
      <CalendarColorBar color={calendarColor} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
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

      <DateTimeField label="Début" value={startDateTime} onChange={onChangeStart} />
      <DateTimeField
        label="Fin"
        value={endDateTime}
        onChange={setEndDateTime}
        minimumDate={startDateTime}
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
      </ScrollView>
    </View>
  );
}
