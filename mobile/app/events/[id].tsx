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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { GoogleLogo } from "../../components/google-logo";
import { AuthImage } from "../../components/auth-image";
import { EventImageViewer } from "../../components/event-image-viewer";
import { VotersListModal } from "../../components/voters-list-modal";
import { Avatar } from "../../components/avatar";
import { api, ApiError } from "../../src/lib/api";
import type { EventDetail, CommentItem, EventFileItem } from "../../src/lib/types";
import { formatDateTime, formatEventRange, formatLeadTime } from "../../src/lib/date";
import { HomeHeaderButton } from "../../components/home-header-button";
import { useSession } from "../../src/lib/session";
import { getHiddenFileIds, hideFile, unhideFiles } from "../../src/lib/hidden-files";

type UploadFileResponse = { success: boolean; id: string; data: { id: string } };
type CalendarMeta = { isPremium: boolean; members: { userId: string; role: string }[] };

const RSVP_COLORS: Record<"YES" | "MAYBE" | "NO", string> = {
  YES: "#22c55e",
  MAYBE: "#f59e0b",
  NO: "#ef4444",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams();
  const idRaw = params.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EventDetail | null>(null);
  const [calendarMeta, setCalendarMeta] = useState<CalendarMeta | null>(null);

  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [pollActionId, setPollActionId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [viewerFile, setViewerFile] = useState<EventFileItem | null>(null);
  const [voterListStatus, setVoterListStatus] = useState<"YES" | "MAYBE" | "NO" | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getHiddenFileIds().then(setHiddenIds);
  }, []);

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

  function deleteComment(commentId: string) {
    Alert.alert(
      "Supprimer le commentaire",
      "Le message sera remplacé par « Message supprimé » — le contenu ne sera plus récupérable.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.del(`/events/${id}/comments/${commentId}`);
              // Suppression douce côté backend : on recharge pour récupérer
              // le placeholder (auteur de la suppression inclus) plutôt que
              // de deviner l'état localement.
              await loadComments();
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e instanceof ApiError ? e.message : "La suppression a échoué",
              );
            }
          },
        },
      ],
    );
  }

  function startEditComment(comment: CommentItem) {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingText("");
  }

  async function saveEditComment(commentId: string) {
    const text = editingText.trim();
    if (!text) return;
    setSavingEdit(true);
    try {
      await api.patch(`/events/${id}/comments/${commentId}`, { text });
      setEditingCommentId(null);
      setEditingText("");
      await loadComments();
    } catch (e: any) {
      Alert.alert("Erreur", e instanceof ApiError ? e.message : "La modification a échoué");
    } finally {
      setSavingEdit(false);
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

  async function voteForOption(optionId: string, alreadyVoted: boolean) {
    if (!id) return;
    setPollActionId(optionId);
    try {
      if (alreadyVoted) {
        // Retape sur son propre choix = désélectionner (retirer le vote).
        await api.del(`/events/${id}/poll/options/${optionId}/vote`);
      } else {
        // Voter pour une nouvelle option retire automatiquement le vote
        // précédent sur une autre option (sondage à choix unique).
        await api.post(`/events/${id}/poll/options/${optionId}/vote`, {});
      }
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", e instanceof ApiError ? e.message : "Le vote a échoué");
    } finally {
      setPollActionId(null);
    }
  }

  function finalizeOption(optionId: string) {
    Alert.alert(
      "Finaliser le sondage",
      "Cette option deviendra l'événement définitif et le sondage sera supprimé (pour éviter le doublon). Confirmer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Finaliser",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setPollActionId(optionId);
            try {
              const res = await api.post<{ data: { finalEvent: { id: string } } }>(
                `/events/${id}/poll/finalize/${optionId}`,
                {},
              );
              // Le sondage est supprimé côté serveur une fois finalisé — on
              // ne peut plus recharger cet écran, on part directement sur
              // l'événement final (replace : impossible de "revenir" sur un
              // événement qui n'existe plus).
              router.replace({
                pathname: "/events/[id]",
                params: { id: res.data.finalEvent.id },
              });
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e instanceof ApiError ? e.message : "La finalisation a échoué",
              );
            } finally {
              setPollActionId(null);
            }
          },
        },
      ],
    );
  }

  async function pickAndUploadImage() {
    if (!id) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Autorisation refusée", "Accès aux photos refusé");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingFile(true);

      // Même traitement que pour les images de couverture : on redimensionne
      // avant l'envoi pour fiabiliser l'upload.
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );

      await api.upload<UploadFileResponse>(`/files/upload?eventId=${id}`, {
        uri: resized.uri,
        name: `photo-${Date.now()}.jpg`,
        type: "image/jpeg",
      });
      await load();
    } catch (e: any) {
      const detail =
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status})`
          : e?.message
            ? String(e.message)
            : "cause inconnue";
      Alert.alert("Échec de l'envoi", detail);
    } finally {
      setUploadingFile(false);
    }
  }

  function deleteAttachment(fileId: string) {
    Alert.alert("Supprimer la photo", "Confirmer la suppression ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/files/${fileId}`);
            await load();
          } catch (e: any) {
            Alert.alert(
              "Erreur",
              e instanceof ApiError ? e.message : "La suppression a échoué",
            );
          }
        },
      },
    ]);
  }

  function hideAttachment(fileId: string) {
    Alert.alert(
      "Masquer cette photo",
      "Elle ne sera plus affichée dans l'app sur cet appareil, mais reste visible pour les autres membres.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Masquer",
          onPress: async () => {
            const next = await hideFile(fileId);
            setHiddenIds(new Set(next));
          },
        },
      ],
    );
  }

  async function unhideEventAttachments(fileIds: string[]) {
    const next = await unhideFiles(fileIds);
    setHiddenIds(new Set(next));
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
    // Seul le tout premier chargement affiche l'écran plein écran (qui
    // démonte la ScrollView) — un rafraîchissement après une action (RSVP,
    // vote, upload…) ne doit pas faire remonter la page tout en haut.
    if (!data) setLoading(true);
    try {
      const res = await api.get<EventDetail>(`/events/${id}/detail`);
      setData(res);
      // Pas bloquant : sert juste à savoir si l'utilisateur peut finaliser un
      // sondage et si le calendrier est premium (pièces jointes).
      api
        .get<CalendarMeta>(`/calendars/${res.calendarId}`)
        .then(setCalendarMeta)
        .catch(() => {});
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

  const isPast = data ? new Date(data.endDateTime).getTime() < Date.now() : false;

  const myRole = calendarMeta?.members.find((m) => m.userId === me?.user.id)?.role ?? null;
  const canFinalizePoll = myRole === "owner" || myRole === "admin";
  const hasAttachmentPremium = !!calendarMeta?.isPremium || !!me?.user.isPremium;

  // Photos masquées localement (par ex. jugées inappropriées) : on les
  // retire de l'affichage sur cet appareil sans rien supprimer côté serveur.
  const visibleFiles = data?.files.items.filter((f) => !hiddenIds.has(f.id)) ?? [];
  const hiddenEventFileIds =
    data?.files.items.filter((f) => hiddenIds.has(f.id)).map((f) => f.id) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: data?.title ?? "Événement",
          headerShown: true,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom },
        }}
      />

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
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 80 }}>
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

          <Text>{formatEventRange(data.startDateTime, data.endDateTime)}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Avatar uri={data.createdBy.avatarUrl} name={data.createdBy.name} size={22} />
            <Text>Créé par : {data.createdBy.name}</Text>
          </View>

          <Text>Description: {data.description ?? "—"}</Text>
          <Text>Lieu: {data.location ?? "—"}</Text>
          <Text>
            Rappels:{" "}
            {data.reminders.length > 0
              ? data.reminders
                  .map((r: { minutesBefore: number }) => formatLeadTime(r.minutesBefore))
                  .join(" · ")
              : "—"}
          </Text>

          {data.type === "POLL" && data.poll ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              <Text style={{ fontWeight: "600" }}>Sondage ✨</Text>
              <Text style={{ opacity: 0.6, fontSize: 12 }}>
                Une fois finalisé, le sondage est remplacé par l'événement définitif.
              </Text>

              {data.poll.options.map((opt) => {
                const label =
                  opt.optionType === "DATE" ? formatDateTime(opt.label) : opt.label;
                const acting = pollActionId === opt.id;
                return (
                  <View
                    key={opt.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: opt.votedByMe ? 2 : 1,
                      gap: 6,
                    }}
                  >
                    <Text>{label}</Text>
                    <Text style={{ opacity: 0.7 }}>
                      {opt.votesCount} vote{opt.votesCount > 1 ? "s" : ""}
                      {opt.votedByMe ? " • Votre choix" : ""}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => voteForOption(opt.id, opt.votedByMe)}
                        disabled={acting}
                        style={{
                          flex: 1,
                          padding: 8,
                          borderRadius: 8,
                          alignItems: "center",
                          borderWidth: 1,
                          opacity: acting ? 0.5 : 1,
                        }}
                      >
                        {acting ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <Text>{opt.votedByMe ? "Retirer" : "Voter"}</Text>
                        )}
                      </Pressable>
                      {canFinalizePoll ? (
                        <Pressable
                          onPress={() => finalizeOption(opt.id)}
                          disabled={acting}
                          style={{
                            flex: 1,
                            padding: 8,
                            borderRadius: 8,
                            alignItems: "center",
                            borderWidth: 1,
                            opacity: acting ? 0.5 : 1,
                          }}
                        >
                          <Text>Finaliser</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={{ marginTop: 8, fontWeight: "600" }}>Présence</Text>
          {isPast ? (
            <Text style={{ opacity: 0.6, fontStyle: "italic" }}>
              Événement terminé — présence verrouillée
            </Text>
          ) : null}
          <Text style={{ opacity: 0.5, fontSize: 11 }}>
            Rester appuyé sur un bouton pour voir qui a répondu
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {(["YES", "MAYBE", "NO"] as const).map((status) => {
              const selected = data.rsvp.mine === status;
              const color = RSVP_COLORS[status];
              return (
                <View key={status} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                  <Pressable
                    onPress={() => setRsvp(status)}
                    onLongPress={() => setVoterListStatus(status)}
                    disabled={rsvpLoading || isPast}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? color : undefined,
                      backgroundColor: selected ? `${color}26` : undefined,
                      opacity: rsvpLoading ? 0.6 : isPast && !selected ? 0.4 : 1,
                    }}
                  >
                    <Text style={{ color: selected ? color : undefined, fontWeight: selected ? "700" : "400" }}>
                      {status}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setVoterListStatus(status)}>
                    <Text style={{ fontSize: 12, opacity: 0.7 }}>{data.rsvp.counts[status]}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ fontWeight: "600" }}>
              Photos {data.files.total > 0 ? `(${data.files.total})` : ""}
              {hasAttachmentPremium ? " ✨" : ""}
            </Text>

            {visibleFiles.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {visibleFiles.map((f) => {
                  const isImage = f.mimeType.startsWith("image/");
                  const canDelete = f.uploadedById === me?.user.id;
                  return (
                    <View key={f.id} style={{ width: 96 }}>
                      {isImage ? (
                        <Pressable onPress={() => setViewerFile(f)}>
                          <AuthImage
                            uri={`/files/${f.id}`}
                            style={{ width: 96, height: 96, borderRadius: 10 }}
                          />
                        </Pressable>
                      ) : (
                        <View
                          style={{
                            width: 96,
                            height: 96,
                            borderRadius: 10,
                            borderWidth: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 6,
                          }}
                        >
                          <Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center" }}>
                            {f.filename}
                          </Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                        {formatFileSize(f.size)}
                      </Text>
                      {canDelete ? (
                        <Pressable onPress={() => deleteAttachment(f.id)}>
                          <Text style={{ fontSize: 11, color: "red" }}>Supprimer</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => hideAttachment(f.id)}>
                          <Text style={{ fontSize: 11, opacity: 0.6 }}>Masquer</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ opacity: 0.6 }}>Aucune photo</Text>
            )}

            {hiddenEventFileIds.length > 0 ? (
              <Pressable onPress={() => unhideEventAttachments(hiddenEventFileIds)}>
                <Text style={{ fontSize: 12, opacity: 0.6 }}>
                  {hiddenEventFileIds.length} photo{hiddenEventFileIds.length > 1 ? "s" : ""}{" "}
                  masquée{hiddenEventFileIds.length > 1 ? "s" : ""} sur cet appareil · Réafficher
                </Text>
              </Pressable>
            ) : null}

            {hasAttachmentPremium ? (
              <Pressable
                onPress={pickAndUploadImage}
                disabled={uploadingFile}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  opacity: uploadingFile ? 0.6 : 1,
                }}
              >
                {uploadingFile ? (
                  <ActivityIndicator />
                ) : (
                  <Text>Ajouter une photo</Text>
                )}
              </Pressable>
            ) : (
              <Text style={{ opacity: 0.6, fontSize: 12 }}>
                Passe en premium pour ajouter des photos ✨
              </Text>
            )}
          </View>

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
                comments.map((c) => {
                  if (c.deletedAt) {
                    return (
                      <View
                        key={c.id}
                        style={{ padding: 10, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8 }}
                      >
                        <Avatar uri={c.user?.avatarUrl} name={c.user?.name} size={28} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "600" }}>{c.user?.name ?? "Utilisateur"}</Text>
                          <Text style={{ fontStyle: "italic", opacity: 0.6 }}>
                            Message supprimé
                            {c.deletedBy ? ` par ${c.deletedBy.name ?? "un membre"}` : ""}
                          </Text>
                          <Text style={{ opacity: 0.7, marginTop: 4 }}>
                            {formatDateTime(c.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  const isOwnComment = c.userId === me?.user.id;
                  const canDeleteComment =
                    isOwnComment || myRole === "owner" || myRole === "admin";
                  const isEditing = editingCommentId === c.id;

                  return (
                  <View
                    key={c.id}
                    style={{ padding: 10, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8 }}
                  >
                    <Avatar uri={c.user?.avatarUrl} name={c.user?.name} size={28} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Text style={{ fontWeight: "600" }}>
                          {c.user?.name ?? "Utilisateur"}
                        </Text>
                        {!isEditing ? (
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            {isOwnComment ? (
                              <Pressable onPress={() => startEditComment(c)}>
                                <Text style={{ fontSize: 12 }}>Modifier</Text>
                              </Pressable>
                            ) : null}
                            {canDeleteComment ? (
                              <Pressable onPress={() => deleteComment(c.id)}>
                                <Text style={{ fontSize: 12, color: "red" }}>Supprimer</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>

                      {isEditing ? (
                        <View style={{ gap: 6, marginTop: 4 }}>
                          <TextInput
                            value={editingText}
                            onChangeText={setEditingText}
                            multiline
                            style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}
                          />
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => saveEditComment(c.id)}
                              disabled={savingEdit}
                              style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: "center", borderWidth: 1, opacity: savingEdit ? 0.6 : 1 }}
                            >
                              <Text>{savingEdit ? "Enregistrement..." : "Enregistrer"}</Text>
                            </Pressable>
                            <Pressable
                              onPress={cancelEditComment}
                              disabled={savingEdit}
                              style={{ flex: 1, padding: 8, borderRadius: 8, alignItems: "center", borderWidth: 1 }}
                            >
                              <Text>Annuler</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <Text>{c.text}</Text>
                          <Text style={{ opacity: 0.7, marginTop: 4 }}>
                            {formatDateTime(c.createdAt)}
                            {c.editedAt ? " · modifié" : ""}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  );
                })
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

          <View style={{ marginTop: 20, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <GoogleLogo size={18} />
              <Text style={{ fontWeight: "600" }}>Google</Text>
            </View>

            {!data.google.synced ? (
              <Pressable
                onPress={exportToGoogle}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                }}
              >
                <GoogleLogo size={16} />
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
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                  }}
                >
                  <GoogleLogo size={16} />
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

      <EventImageViewer file={viewerFile} onClose={() => setViewerFile(null)} />

      <VotersListModal
        status={voterListStatus}
        color={voterListStatus ? RSVP_COLORS[voterListStatus] : "#000"}
        voters={data?.rsvp.voters.filter((v) => v.status === voterListStatus) ?? []}
        onClose={() => setVoterListStatus(null)}
      />
    </View>
  );
}
