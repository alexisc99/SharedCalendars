import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "../src/lib/session";
import { ApiError } from "../src/lib/api";

export default function SignupScreen() {
  const { signup } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Le nom est requis");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }

    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      // _layout redirigera vers /(tabs) une fois `me` chargé
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Créer un compte</Text>

      <Text>Nom</Text>
      <TextInput
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Email</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text>Mot de passe</Text>
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
          borderWidth: 1,
        }}
      >
        <Text>{loading ? "Création..." : "Créer le compte"}</Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center", padding: 8 }}>
        <Text style={{ opacity: 0.7 }}>J'ai déjà un compte</Text>
      </Pressable>
    </View>
  );
}
