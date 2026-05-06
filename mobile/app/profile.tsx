import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "../src/lib/session";
import { api, ApiError } from "../src/lib/api";

export default function ProfileScreen() {
  const router = useRouter();
  const { me, refreshMe, logout } = useSession();

  const [name, setName] = useState(me?.user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!me) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Non connecté.</Text>
      </View>
    );
  }

  const dirty = name.trim() !== (me.user.name ?? "");

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
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Profil</Text>

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
