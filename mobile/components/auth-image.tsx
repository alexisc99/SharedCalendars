import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ImageStyle, StyleProp, Text, View } from "react-native";
import { getToken } from "../src/lib/authToken";
import { API_BASE_URL } from "../src/config/env";
import { fetchWithRetry } from "../src/lib/api";

type Props = {
  /** URL absolue (http…) ou chemin relatif servi par notre API (ex. "/files/abc123"). */
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
};

/**
 * <Image> qui sait aussi charger les fichiers hébergés par notre propre API
 * (ex. une image de couverture envoyée depuis le téléphone).
 *
 * Le support des en-têtes personnalisés sur <Image source={{headers}}> est
 * peu fiable selon les plateformes RN, et un échec y est silencieux (rien ne
 * s'affiche, aucune erreur). On passe donc par le même fetch() authentifié
 * que le reste de l'app (dont on sait qu'il fonctionne), et on convertit la
 * réponse en data URI — avec un vrai message si ça échoue.
 */
export function AuthImage({ uri, style, resizeMode = "cover" }: Props) {
  const isOwnFile = !uri.startsWith("http");
  const fullUri = isOwnFile ? `${API_BASE_URL}${uri}` : uri;

  const [dataUri, setDataUri] = useState<string | null>(isOwnFile ? null : fullUri);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwnFile) {
      setDataUri(fullUri);
      setError(null);
      return;
    }

    let cancelled = false;
    setDataUri(null);
    setError(null);

    (async () => {
      try {
        const token = await getToken();
        const res = await fetchWithRetry(fullUri, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const reader = new FileReader();
        reader.onerror = () => {
          if (!cancelled) setError("Lecture impossible");
        };
        reader.onloadend = () => {
          if (cancelled) return;
          if (typeof reader.result === "string") setDataUri(reader.result);
          else setError("Format inattendu");
        };
        reader.readAsDataURL(blob);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur de chargement");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fullUri, isOwnFile]);

  if (error) {
    return (
      <View
        style={[
          style,
          {
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderStyle: "dashed",
          },
        ]}
      >
        <Text style={{ opacity: 0.5, fontSize: 12 }}>Image indisponible</Text>
      </View>
    );
  }

  if (!dataUri) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Image source={{ uri: dataUri }} style={style} resizeMode={resizeMode} />;
}
