import React, { useState } from "react";
import { Text } from "./themed/text";
import { View } from "./themed/view";
import { Pressable } from "./themed/pressable";
import { AuthImage } from "./auth-image";
import { EventImageViewer } from "./event-image-viewer";

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  isPremium?: boolean;
};

const FALLBACK_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

/** Photo de profil ronde, avec initiale colorée en repli quand il n'y en a
 * pas. Un tap sur une vraie photo l'ouvre en plein écran (même visionneuse
 * que pour les photos d'événement, avec partage/enregistrement). Un petit
 * badge ✨ apparaît en bas à droite pour un membre premium. */
export function Avatar({ uri, name, size = 32, isPremium = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Toujours de la forme "/files/<id>" pour un avatar uploadé depuis l'app —
  // sans ça (URL externe éventuelle), on affiche juste l'image sans l'agrandir.
  const fileId = uri?.startsWith("/files/") ? uri.slice("/files/".length) : null;

  const badge = isPremium ? (
    <View
      style={{
        position: "absolute",
        right: -2,
        bottom: -2,
        width: Math.max(14, size * 0.4),
        height: Math.max(14, size * 0.4),
        borderRadius: Math.max(7, (size * 0.4) / 2),
        backgroundColor: "#fbbf24",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "white",
      }}
    >
      <Text style={{ fontSize: Math.max(8, size * 0.24) }}>✨</Text>
    </View>
  ) : null;

  if (uri) {
    const image = (
      <AuthImage uri={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );

    return (
      <View style={{ width: size, height: size }}>
        {fileId ? (
          <Pressable onPress={() => setExpanded(true)}>{image}</Pressable>
        ) : (
          image
        )}
        {fileId ? (
          <EventImageViewer
            file={
              expanded
                ? { id: fileId, filename: `${name ?? "avatar"}.jpg`, mimeType: "image/jpeg" }
                : null
            }
            onClose={() => setExpanded(false)}
          />
        ) : null}
        {badge}
      </View>
    );
  }

  const label = (name?.trim() || "?")[0]?.toUpperCase() ?? "?";
  const bg = name?.trim() ? colorForName(name.trim()) : "#9ca3af";

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: size * 0.42, fontWeight: "700" }}>{label}</Text>
      </View>
      {badge}
    </View>
  );
}
