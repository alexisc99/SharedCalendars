import React, { useEffect, useState } from "react";
import {
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { TextInput } from "@/components/themed/text-input";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Link, useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { api, ApiError } from "../../../src/lib/api";
import { useSession } from "../../../src/lib/session";
import { FREE_THEMES, PREMIUM_THEMES, THEME_COLORS, colorForTheme } from "../../../src/lib/theme";
import { CalendarColorBar } from "../../../components/calendar-color-bar";
import { HomeHeaderButton } from "../../../components/home-header-button";
import { AuthImage } from "../../../components/auth-image";

type UploadFileResponse = {
  success: boolean;
  id: string;
  data: { id: string };
};

type CalendarDetail = {
  id: string;
  name: string;
  color: string | null;
  theme: string | null;
  coverImageUrl: string | null;
  isPremium: boolean;
  ownerId: string;
};

export default function EditCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const calendarId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const { me } = useSession();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarDetail | null>(null);

  const [name, setName] = useState("");
  const [theme, setTheme] = useState("default");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  async function load() {
    if (!calendarId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get<CalendarDetail>(`/calendars/${calendarId}`);
      setCalendar(res);
      setName(res.name ?? "");
      setTheme(res.theme ?? "default");
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
  const previewColor = colorForTheme(theme);

  async function onSave() {
    if (!calendarId) return;
    setSaveError(null);

    if (!name.trim()) {
      setSaveError("Le nom est requis");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        theme,
        // Le thème est la seule source de vérité pour la couleur affichée.
        color: colorForTheme(theme),
      };
      if (calendar?.isPremium) body.coverImageUrl = coverImageUrl.trim() || null;

      await api.patch(`/calendars/${calendarId}`, body);
      router.back();
    } catch (e: any) {
      setSaveError(e instanceof ApiError ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function pickCoverImage() {
    if (!calendarId) return;
    setSaveError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSaveError("Autorisation d'accès aux photos refusée");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingCover(true);

      // Les photos de téléphone récentes pèsent plusieurs Mo même compressées
      // par le picker — on les redimensionne avant l'envoi pour fiabiliser
      // l'upload (une image trop lourde peut faire échouer le fetch avec une
      // simple "Network request failed", sans erreur serveur explicite).
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );

      const res = await api.upload<UploadFileResponse>(
        `/files/upload?calendarId=${calendarId}&purpose=cover`,
        {
          uri: resized.uri,
          name: `cover-${Date.now()}.jpg`,
          type: "image/jpeg",
        },
      );
      setCoverImageUrl(`/files/${res.data.id}`);
    } catch (e: any) {
      console.error("[pickCoverImage] failed", e);
      const detail =
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : e?.message
            ? String(e.message)
            : typeof e === "string"
              ? e
              : "cause inconnue";
      setSaveError(`Échec de l'envoi de l'image : ${detail}`);
    } finally {
      setUploadingCover(false);
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
      <View style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: "Modifier",
            headerShown: true,
            headerRight: () => <HomeHeaderButton />,
            contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
          }}
        />
        <CalendarColorBar color={previewColor} />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
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
            title: "Modifier",
            headerShown: true,
            headerRight: () => <HomeHeaderButton />,
            contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
          }}
        />
        <CalendarColorBar color={previewColor} />
        <View style={{ padding: 16, gap: 12 }}>
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: calendar?.name ? `${calendar.name} · Modifier` : "Modifier le calendrier",
          headerShown: true,
          headerTintColor: previewColor,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
        }}
      />
      <CalendarColorBar color={previewColor} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text>Nom *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Thème par défaut du calendrier</Text>
      <Text style={{ opacity: 0.6, fontSize: 12 }}>
        Vu par les membres qui n'ont pas choisi leur propre couleur (réglage
        "Ma couleur pour ce calendrier" sur l'écran du calendrier).
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {availableThemes.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTheme(t)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: theme === t ? 2 : 1,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: THEME_COLORS[t],
              }}
            />
            <Text>
              {t}
              {(PREMIUM_THEMES as readonly string[]).includes(t) ? " ✨" : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      {!calendar?.isPremium ? (
        <Link href="/premium" asChild>
          <Pressable>
            <Text style={{ opacity: 0.6, fontSize: 12, textDecorationLine: "underline" }}>
              Passe ce calendrier en premium pour débloquer plus de thèmes ✨
            </Text>
          </Pressable>
        </Link>
      ) : null}

      {calendar?.isPremium ? (
        <>
          <Text>Image de couverture ✨</Text>

          <Pressable
            onPress={pickCoverImage}
            disabled={uploadingCover}
            style={{
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              opacity: uploadingCover ? 0.6 : 1,
            }}
          >
            {uploadingCover ? (
              <ActivityIndicator />
            ) : (
              <Text>Choisir une photo sur mon téléphone</Text>
            )}
          </Pressable>

          <Text style={{ opacity: 0.6, fontSize: 12 }}>
            …ou colle l'URL d'une image en ligne :
          </Text>
          <TextInput
            value={coverImageUrl}
            onChangeText={setCoverImageUrl}
            autoCapitalize="none"
            placeholder="https://…"
            style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
          {coverImageUrl.trim() ? (
            <AuthImage
              uri={coverImageUrl.trim()}
              style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 10 }}
            />
          ) : null}
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
          borderColor: previewColor,
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
    </View>
  );
}
