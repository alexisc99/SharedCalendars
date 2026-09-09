import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
// SDK 54 a remplacé l'API expo-file-system (classes File/Directory) — on
// garde l'ancienne API via "/legacy" (cacheDirectory + downloadAsync avec
// en-têtes), plus simple ici et toujours officiellement supportée.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { AuthImage } from "./auth-image";
import { API_BASE_URL } from "../src/config/env";
import { getToken } from "../src/lib/authToken";

/** Le strict nécessaire pour afficher/partager/enregistrer un fichier — un
 * EventFileItem satisfait cette forme, mais aussi un simple avatar. */
export type ViewableFile = { id: string; filename: string; mimeType: string };

type Props = {
  file: ViewableFile | null;
  onClose: () => void;
};

/**
 * Télécharge le fichier authentifié vers un fichier local temporaire.
 * FileSystem.downloadAsync() gère les en-têtes personnalisés de façon fiable
 * (contrairement à <Image source={{headers}}>) et donne directement une vraie
 * URI de fichier — nécessaire pour le partage et l'enregistrement, qui
 * n'acceptent pas les data URI en base64.
 */
async function downloadToCache(file: ViewableFile): Promise<string> {
  const token = await getToken();
  const remoteUri = `${API_BASE_URL}/files/${file.id}`;
  const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || file.id;
  const localUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;

  const result = await FileSystem.downloadAsync(remoteUri, localUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return result.uri;
}

export function EventImageViewer({ file, onClose }: Props) {
  const [busy, setBusy] = useState<"share" | "save" | null>(null);

  if (!file) return null;

  async function handleShare() {
    if (!file) return;
    setBusy("share");
    try {
      const localUri = await downloadToCache(file);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Indisponible", "Le partage n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(localUri, { mimeType: file.mimeType });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Le partage a échoué");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!file) return;
    setBusy("save");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Autorisation refusée", "Impossible d'enregistrer sans accès à tes photos.");
        return;
      }
      const localUri = await downloadToCache(file);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Enregistré", "L'image a été ajoutée à ta galerie.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "L'enregistrement a échoué");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={!!file} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}>
        <Pressable
          onPress={onClose}
          style={{ position: "absolute", top: 50, right: 20, zIndex: 1, padding: 10 }}
        >
          <Text style={{ color: "white", fontSize: 20 }}>✕</Text>
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
          <AuthImage
            uri={`/files/${file.id}`}
            style={{ width: "100%", height: "80%" }}
            resizeMode="contain"
          />
        </View>

        <View style={{ flexDirection: "row", gap: 12, padding: 20, paddingBottom: 40 }}>
          <Pressable
            onPress={handleShare}
            disabled={busy !== null}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.15)",
              opacity: busy !== null && busy !== "share" ? 0.5 : 1,
            }}
          >
            {busy === "share" ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white" }}>Partager</Text>
            )}
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={busy !== null}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.15)",
              opacity: busy !== null && busy !== "save" ? 0.5 : 1,
            }}
          >
            {busy === "save" ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "white" }}>Enregistrer</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
