import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { api, ApiError } from "../../../src/lib/api";
import { useSession } from "../../../src/lib/session";

type CalendarDetail = {
  id: string;
  name: string;
  color: string | null;
  theme: string | null;
  coverImageUrl: string | null;
  isPremium: boolean;
  ownerId: string;
};

const FREE_THEMES = ["default", "blue", "green", "red"];
const PREMIUM_THEMES = ["gold", "night-sky", "gradient-purple"];

export default function EditCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const { me } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarDetail | null>(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [theme, setTheme] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<CalendarDetail>(`/calendars/${calendarId}`);
      setCalendar(res);
      setName(res.name ?? "");
      setColor(res.color ?? "");
      setTheme(res.theme ?? "");
      setCoverImageUrl(res.coverImageUrl ?? "");
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [calendarId]);

  const isOwner = !!calendar && !!me && calendar.ownerId === me.user.id;
  const availableThemes = calendar?.isPremium
    ? [...FREE_THEMES, ...PREMIUM_THEMES]
    : FREE_THEMES;

  async function onSave() {
    if (!calendarId) return;
    setSaveError(null);

    if (!name.trim()) {
      setSaveError("Le nom est requis");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      body.color = color.trim() || null;
      if (theme.trim()) body.theme = theme.trim();
      if (calendar?.isPremium) body.coverImageUrl = coverImageUrl.trim() || null;

      await api.patch(`/calendars/${calendarId}`, body);
      router.back();
    } catch (e: any) {
      setSaveError(e instanceof ApiError ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!calendarId) return;
    Alert.alert(
      "Supprimer le calendrier",
      "Cette action est irréversible : tous les événements, fichiers et membres seront supprimés. Confirmer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.del(`/calendars/${calendarId}`);
              router.replace("/(tabs)/calendars");
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e instanceof ApiError ? e.message : "Erreur inconnue",
              );
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Stack.Screen options={{ title: "Modifier" }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: "Modifier" }} />
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
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: "Modifier le calendrier" }} />

      <Text>Nom *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Couleur (ex. #4f46e5)</Text>
      <TextInput
        value={color}
        onChangeText={setColor}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Thème</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {availableThemes.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTheme(t)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: theme === t ? 2 : 1,
            }}
          >
            <Text>
              {t}
              {PREMIUM_THEMES.includes(t) ? " ✨" : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      {!calendar?.isPremium ? (
        <Text style={{ opacity: 0.6, fontSize: 12 }}>
          Passe en premium pour débloquer plus de thèmes ✨
        </Text>
      ) : null}

      {calendar?.isPremium ? (
        <>
          <Text>Image de couverture (URL)</Text>
          <TextInput
            value={coverImageUrl}
            onChangeText={setCoverImageUrl}
            autoCapitalize="none"
            style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
        </>
      ) : null}

      {saveError ? <Text style={{ color: "red" }}>{saveError}</Text> : null}

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Text>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
      </Pressable>

      {isOwner ? (
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={{
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "red",
            marginTop: 20,
            opacity: deleting ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "red" }}>
            {deleting ? "Suppression..." : "Supprimer le calendrier"}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
