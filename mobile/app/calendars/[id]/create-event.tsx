import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { TextInput } from "@/components/themed/text-input";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { api, ApiError } from "../../../src/lib/api";
import { DateTimeField } from "../../../components/date-time-field";
import { colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";
import { ReminderPicker } from "../../../components/reminder-picker";
import { useSession } from "../../../src/lib/session";

type EventKind = "STANDARD" | "POLL";
type PollType = "DATE" | "LOCATION";

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
  const themeColors = useThemeColors();
  const { me } = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const [startDateTime, setStartDateTime] = useState<Date>(defaultStart);
  const [endDateTime, setEndDateTime] = useState<Date>(() => defaultEnd(defaultStart()));

  // Un sondage requiert un compte premium OU un calendrier premium (même
  // logique que le backend : membership.user.isPremium || calendar.isPremium).
  const [calendarIsPremium, setCalendarIsPremium] = useState(false);
  const isPremium = calendarIsPremium || !!me?.user.isPremium;

  const [reminders, setReminders] = useState<number[]>([]);

  const [eventKind, setEventKind] = useState<EventKind>("STANDARD");
  const [pollType, setPollType] = useState<PollType>("DATE");
  const [pollOptionLabels, setPollOptionLabels] = useState<string[]>(["", ""]);
  const [pollOptionDates, setPollOptionDates] = useState<Date[]>(() => [
    defaultStart(),
    defaultEnd(defaultStart()),
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!calendarId) return;
    api
      .get<{ isPremium: boolean }>(`/calendars/${calendarId}`)
      .then((res) => setCalendarIsPremium(!!res.isPremium))
      .catch(() => {
        // pas bloquant : on retentera juste la création si l'utilisateur essaie
      });
  }, [calendarId]);

  function onChangeStart(next: Date) {
    setStartDateTime(next);
    if (endDateTime <= next) {
      setEndDateTime(defaultEnd(next));
    }
  }

  function selectEventKind(kind: EventKind) {
    if (kind === "POLL" && !isPremium) return;
    setEventKind(kind);
  }

  function addPollOption() {
    if (pollType === "LOCATION") {
      if (pollOptionLabels.length >= 10) return;
      setPollOptionLabels((prev) => [...prev, ""]);
    } else {
      if (pollOptionDates.length >= 10) return;
      const last = pollOptionDates[pollOptionDates.length - 1] ?? defaultStart();
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      setPollOptionDates((prev) => [...prev, next]);
    }
  }

  function removePollOption(index: number) {
    if (pollType === "LOCATION") {
      if (pollOptionLabels.length <= 2) return;
      setPollOptionLabels((prev) => prev.filter((_, i) => i !== index));
    } else {
      if (pollOptionDates.length <= 2) return;
      setPollOptionDates((prev) => prev.filter((_, i) => i !== index));
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

    let pollOptions: { label: string }[] | undefined;
    if (eventKind === "POLL") {
      if (pollType === "LOCATION") {
        const trimmed = pollOptionLabels.map((l) => l.trim());
        if (trimmed.some((l) => !l)) {
          setError("Chaque option de sondage doit avoir un lieu");
          return;
        }
        pollOptions = trimmed.map((label) => ({ label }));
      } else {
        pollOptions = pollOptionDates.map((d) => ({ label: d.toISOString() }));
      }
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
        ...(reminders.length > 0
          ? { reminders: reminders.map((minutesBefore) => ({ minutesBefore })) }
          : {}),
        ...(eventKind === "POLL"
          ? { type: "POLL", pollType, pollOptions }
          : {}),
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
          contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
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

      <ReminderPicker value={reminders} onChange={setReminders} isPremium={isPremium} />

      <Text>Type d'événement</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => selectEventKind("STANDARD")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: eventKind === "STANDARD" ? 2 : 1,
          }}
        >
          <Text>Standard</Text>
        </Pressable>
        <Pressable
          onPress={() => selectEventKind("POLL")}
          disabled={!isPremium}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: eventKind === "POLL" ? 2 : 1,
            opacity: isPremium ? 1 : 0.5,
          }}
        >
          <Text>Sondage ✨</Text>
        </Pressable>
      </View>
      {!isPremium ? (
        <Text style={{ opacity: 0.6, fontSize: 12 }}>
          Passe en premium pour créer des sondages ✨
        </Text>
      ) : null}

      {eventKind === "POLL" ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={{ fontWeight: "600" }}>Sondage</Text>

          <Text>Les membres votent pour…</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setPollType("DATE")}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: pollType === "DATE" ? 2 : 1,
              }}
            >
              <Text>Une date</Text>
            </Pressable>
            <Pressable
              onPress={() => setPollType("LOCATION")}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: pollType === "LOCATION" ? 2 : 1,
              }}
            >
              <Text>Un lieu</Text>
            </Pressable>
          </View>

          {pollType === "DATE" ? (
            <Text style={{ opacity: 0.6, fontSize: 12 }}>
              Les dates de début/fin ci-dessus ne sont qu'un repère : la date
              choisie par le vote remplacera l'événement une fois le sondage
              finalisé.
            </Text>
          ) : null}

          <Text>Options ({pollType === "DATE" ? pollOptionDates.length : pollOptionLabels.length})</Text>

          {pollType === "DATE"
            ? pollOptionDates.map((d, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <DateTimeField
                      label={`Option ${i + 1}`}
                      value={d}
                      onChange={(next) =>
                        setPollOptionDates((prev) => prev.map((v, idx) => (idx === i ? next : v)))
                      }
                    />
                  </View>
                  <Pressable
                    onPress={() => removePollOption(i)}
                    disabled={pollOptionDates.length <= 2}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      opacity: pollOptionDates.length <= 2 ? 0.3 : 1,
                    }}
                  >
                    <Text>✕</Text>
                  </Pressable>
                </View>
              ))
            : pollOptionLabels.map((label, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    value={label}
                    onChangeText={(text) =>
                      setPollOptionLabels((prev) => prev.map((v, idx) => (idx === i ? text : v)))
                    }
                    placeholder={`Lieu ${i + 1}`}
                    style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 10 }}
                  />
                  <Pressable
                    onPress={() => removePollOption(i)}
                    disabled={pollOptionLabels.length <= 2}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      opacity: pollOptionLabels.length <= 2 ? 0.3 : 1,
                    }}
                  >
                    <Text>✕</Text>
                  </Pressable>
                </View>
              ))}

          <Pressable
            onPress={addPollOption}
            style={{ padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
          >
            <Text>+ Ajouter une option</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={onCreate}
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          marginTop: 8,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text>{loading ? "Création..." : "Créer"}</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}
