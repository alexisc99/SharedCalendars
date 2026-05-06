import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api, ApiError } from "../../src/lib/api";
import type { EventDetail, CommentItem } from "../../src/lib/types";

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EventDetail | null>(null);

  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const [rsvpLoading, setRsvpLoading] = useState(false);

  async function loadComments() {
    if (!id) return;
    setCommentsError(null);
    setCommentsLoading(true);
    try {
      const res = await api.get<CommentItem[]>(`/events/${id}/comments`);
      setComments(res);
    } catch (e: any) {
      if (e instanceof ApiError) setCommentsError(e.message);
      else setCommentsError("Erreur inconnue");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function postComment() {
    if (!id) return;
    const text = newComment.trim();
    if (!text) return;

    setPosting(true);
    try {
      await api.post(`/events/${id}/comments`, { text });
      setNewComment("");
      await loadComments(); // refresh simple (puis pagination plus tard)
    } catch (e: any) {
      // on affiche l'erreur dans commentsError pour rester simple
      if (e instanceof ApiError) setCommentsError(e.message);
      else setCommentsError("Erreur inconnue");
    } finally {
      setPosting(false);
    }
  }

  async function setRsvp(status: "YES" | "MAYBE" | "NO") {
    if (!id) return;

    setRsvpLoading(true);
    try {
      await api.post(`/events/${id}/rsvp`, { status });

      // refresh event detail pour mettre à jour mine + counts
      await load();
    } catch (e: any) {
      // réutilise l'erreur principale de l'écran
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setRsvpLoading(false);
    }
  }

  async function deleteEvent() {
    if (!id) return;

    Alert.alert(
      "Supprimer l'événement",
      "Êtes-vous sûr de vouloir supprimer cet événement ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.del(`/events/${id}`);
              // retour vers la liste du calendrier
              router.back();
            } catch (e: any) {
              if (e instanceof ApiError) setError(e.message);
              else setError("Erreur inconnue");
            }
          },
        },
      ],
    );
  }
  async function exportToGoogle() {
    if (!id) return;
    try {
      await api.post(`/integrations/google/events/${id}`, {});
      await load(); // recharge event detail
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    }
  }

  async function updateGoogle() {
    if (!id) return;
    try {
      await api.patch(`/integrations/google/events/${id}`, {});
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    }
  }

  async function deleteFromGoogle() {
    if (!id) return;
    try {
      await api.del(`/integrations/google/events/${id}`);
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    }
  }

  async function load() {
    if (!id) {
      setError("ID événement manquant");
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await api.get<EventDetail>(`/events/${id}/detail`);
      setData(res);
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadComments();
  }, [id]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: data?.title ?? "Événement" }} />

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
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
      ) : !data ? (
        <View style={{ padding: 16 }}>
          <Text>Événement introuvable</Text>
        </View>
      ) : (
        <ScrollView style={{ padding: 16, gap: 10, paddingBottom: 80 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>{data.title}</Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/events/[id]/edit", params: { id } })
            }
            style={{
              padding: 10,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
            }}
          >
            <Text>Modifier</Text>
          </Pressable>

          <Text>
            {data.startDateTime} → {data.endDateTime}
          </Text>

          <Text>Créé par: {data.createdBy.name}</Text>
          <Text>Status: {data.status}</Text>

          <Text>Description: {data.description ?? "—"}</Text>
          <Text>Lieu: {data.location ?? "—"}</Text>

          <Text style={{ marginTop: 8, fontWeight: "600" }}>RSVP</Text>
          <Text>Moi: {data.rsvp.mine ?? "—"}</Text>
          <Text>
            YES {data.rsvp.counts.YES} • MAYBE {data.rsvp.counts.MAYBE} • NO{" "}
            {data.rsvp.counts.NO}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => setRsvp("YES")}
              disabled={rsvpLoading}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity: rsvpLoading ? 0.6 : 1,
              }}
            >
              <Text>YES</Text>
            </Pressable>

            <Pressable
              onPress={() => setRsvp("MAYBE")}
              disabled={rsvpLoading}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity: rsvpLoading ? 0.6 : 1,
              }}
            >
              <Text>MAYBE</Text>
            </Pressable>

            <Pressable
              onPress={() => setRsvp("NO")}
              disabled={rsvpLoading}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity: rsvpLoading ? 0.6 : 1,
              }}
            >
              <Text>NO</Text>
            </Pressable>
          </View>

          <Text style={{ marginTop: 8, fontWeight: "600" }}>Interactions</Text>
          <Text>Commentaires: {data.comments.total}</Text>
          <Text>Fichiers: {data.files.total}</Text>

          <Text style={{ marginTop: 12, fontWeight: "600" }}>Commentaires</Text>

          {commentsLoading ? (
            <ActivityIndicator />
          ) : commentsError ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "red" }}>{commentsError}</Text>
              <Pressable
                onPress={loadComments}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 1,
                }}
              >
                <Text>Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {comments.length === 0 ? (
                <Text>Aucun commentaire</Text>
              ) : (
                comments.map((c) => (
                  <View
                    key={c.id}
                    style={{ padding: 10, borderRadius: 10, borderWidth: 1 }}
                  >
                    <Text style={{ fontWeight: "600" }}>
                      {c.user?.name ?? "Utilisateur"}
                    </Text>
                    <Text>{c.text}</Text>
                    <Text style={{ opacity: 0.7, marginTop: 4 }}>
                      {c.createdAt}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ marginTop: 10, gap: 8 }}>
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Écrire un commentaire..."
              style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
              multiline
            />

            <Pressable
              onPress={postComment}
              disabled={posting}
              style={{
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                opacity: posting ? 0.6 : 1,
              }}
            >
              <Text>{posting ? "Envoi..." : "Envoyer"}</Text>
            </Pressable>
          </View>

          <Text style={{ marginTop: 8, fontWeight: "600" }}>Google</Text>
          <View style={{ marginTop: 20, gap: 8 }}>
            <Text style={{ fontWeight: "600" }}>Google</Text>

            {!data.google.synced ? (
              <Pressable
                onPress={exportToGoogle}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 1,
                }}
              >
                <Text>Exporter vers Google</Text>
              </Pressable>
            ) : (
              <>
                <Text style={{ opacity: 0.7 }}>
                  Synchronisé ({data.google.calendarId})
                </Text>

                <Pressable
                  onPress={updateGoogle}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1,
                  }}
                >
                  <Text>Mettre à jour Google</Text>
                </Pressable>

                <Pressable
                  onPress={deleteFromGoogle}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1,
                  }}
                >
                  <Text style={{ color: "red" }}>Supprimer de Google</Text>
                </Pressable>
              </>
            )}
          </View>
          <Text>Synced: {data.google.synced ? "Oui" : "Non"}</Text>
          <Text>Imported: {data.google.imported ? "Oui" : "Non"}</Text>
          <Pressable
            onPress={deleteEvent}
            style={{
              padding: 10,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: 1,
              marginTop: 8,
            }}
          >
            <Text style={{ color: "red" }}>Supprimer</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
