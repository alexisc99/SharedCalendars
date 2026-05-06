import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useSession } from "../src/lib/session";
import { ApiError } from "../src/lib/api";

export default function LoginScreen() {
  const { login } = useSession();

  const [email, setEmail] = useState("alphatest@test.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // le gate dans _layout redirigera automatiquement vers /(tabs)
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Connexion</Text>

      <Text>Email</Text>
      <TextInput
        autoCapitalize="none"
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
        <Text>{loading ? "Connexion..." : "Se connecter"}</Text>
      </Pressable>
    </View>
  );
}
