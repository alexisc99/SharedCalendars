import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useSession } from "../src/lib/session";
import { api, ApiError } from "../src/lib/api";
import { Avatar } from "../components/avatar";

type UploadFileResponse = { success: boolean; id: string; data: { id: string } };

export default function ProfileScreen() {
  const { me, refreshMe, logout } = useSession();

  const [name, setName] = useState(me?.user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Non connecté.</Text>
      </View>
    );
  }

  const dirty = name.trim() !== (me.user.name ?? "");

  async function pickAvatar() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Autorisation d'accès aux photos refusée");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);

      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const res = await api.upload<UploadFileResponse>(`/files/upload?purpose=avatar`, {
        uri: resized.uri,
        name: `avatar-${Date.now()}.jpg`,
        type: "image/jpeg",
      });

      await api.patch("/users/me", { avatarUrl: `/files/${res.data.id}` });
      await refreshMe();
      setInfo("Photo de profil mise à jour");
    } catch (e: any) {
      const detail =
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : e?.message
            ? String(e.message)
            : "cause inconnue";
      setError(`Échec de l'envoi de la photo : ${detail}`);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSave() {
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      await api.patch("/users/me", { name: name.trim() });
      await refreshMe();
      setInfo("Profil mis à jour");
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    Alert.alert("Se déconnecter", "Confirmer la déconnexion ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion",
        style: "destructive",
        onPress: async () => {
          await logout();
          // Le gate dans _layout redirige automatiquement vers /login dès
          // que la session devient vide (même pattern que la connexion) —
          // un router.replace() manuel ici en double avec cet effet pouvait
          // faire dérailler la pile de navigation.
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Profil</Text>

      <View style={{ alignItems: "center", gap: 10 }}>
        <Avatar uri={me.user.avatarUrl} name={me.user.name ?? me.user.email} size={88} />
        <Pressable onPress={pickAvatar} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ opacity: 0.7 }}>Changer la photo de profil</Text>
          )}
        </Pressable>
      </View>

      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 }}>
        <Text style={{ opacity: 0.6 }}>Email</Text>
        <Text style={{ fontSize: 16 }}>{me.user.email}</Text>
      </View>

      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 }}>
        <Text style={{ opacity: 0.6 }}>Nom</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
        />
        <Pressable
          onPress={onSave}
          disabled={!dirty || saving}
          style={{
            padding: 10,
            borderRadius: 8,
            alignItems: "center",
            borderWidth: 1,
            opacity: !dirty || saving ? 0.5 : 1,
          }}
        >
          <Text>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
        </Pressable>
        {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
        {info ? <Text style={{ color: "green" }}>{info}</Text> : null}
      </View>

      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 }}>
        <Text>Premium : {me.user.isPremium ? "Oui" : "Non"}</Text>
        <Text>Google connecté : {me.integrations.googleConnected ? "Oui" : "Non"}</Text>
        <Text style={{ opacity: 0.7 }}>
          Membre depuis : {new Date(me.user.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <Link href="/notification-preferences" asChild>
        <Pressable
          style={{
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
          }}
        >
          <Text>Préférences de notifications</Text>
        </Pressable>
      </Link>

      <Pressable
        onPress={onLogout}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "red",
        }}
      >
        <Text style={{ color: "red" }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
