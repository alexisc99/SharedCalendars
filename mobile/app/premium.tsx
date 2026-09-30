import React, { useEffect, useState } from "react";
import { ScrollView, ActivityIndicator, Alert } from "react-native";
import { Text } from "@/components/themed/text";
import { View } from "@/components/themed/view";
import { Pressable } from "@/components/themed/pressable";
import { TextInput } from "@/components/themed/text-input";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { api, ApiError } from "../src/lib/api";
import { useSession } from "../src/lib/session";
import { formatDateTime } from "../src/lib/date";
import { HomeHeaderButton } from "../components/home-header-button";
import { BRAND } from "../src/lib/colors";
import type {
  CalendarSummary,
  GroupSeatTier,
  MyPurchasesStatus,
  PlansResponse,
} from "../src/lib/types";

type BillingPeriod = "monthly" | "annual";

const PREMIUM_FEATURES: { icon: string; label: string }[] = [
  { icon: "📊", label: "Sondages (choix de date ou de lieu)" },
  { icon: "📷", label: "Photos dans les événements" },
  { icon: "🎨", label: "Thèmes premium + image de couverture personnalisée" },
  { icon: "⏰", label: "Plusieurs rappels par événement" },
];

function formatPrice(priceCents: number): string {
  return `${(priceCents / 100).toFixed(2).replace(".", ",")} €`;
}

function tierForSeats(tiers: GroupSeatTier[], seats: number): GroupSeatTier | undefined {
  return tiers.find((t) => seats <= t.maxSeats);
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { me, refreshMe } = useSession();
  const params = useLocalSearchParams();
  const calendarIdRaw = params.calendarId;
  // Si on arrive depuis les réglages d'un calendrier précis, on ne montre
  // que celui-là — sinon "lequel des miens veux-tu passer premium ?" est
  // une question de trop.
  const focusedCalendarId = Array.isArray(calendarIdRaw) ? calendarIdRaw[0] : calendarIdRaw;

  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [status, setStatus] = useState<MyPurchasesStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // clé de l'action en cours
  const [seatsByCalendar, setSeatsByCalendar] = useState<Record<string, string>>({});
  const [periodByCalendar, setPeriodByCalendar] = useState<Record<string, BillingPeriod>>({});

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [plansRes, statusRes, calendarsRes] = await Promise.all([
        api.get<PlansResponse>("/purchases/plans"),
        api.get<MyPurchasesStatus>("/purchases/me"),
        api.get<CalendarSummary[]>("/calendars/my"),
      ]);
      setPlans(plansRes);
      setStatus(statusRes);
      setCalendars(calendarsRes.filter((c) => c.role === "owner"));
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function startTrial() {
    setBusy("trial");
    try {
      await api.post("/purchases/trial");
      await Promise.all([load(), refreshMe()]);
    } catch (e: any) {
      Alert.alert("Erreur", e instanceof ApiError ? e.message : "Impossible de démarrer l'essai");
    } finally {
      setBusy(null);
    }
  }

  async function buyIndividual() {
    setBusy("individual");
    try {
      await api.post("/purchases/individual");
      await Promise.all([load(), refreshMe()]);
    } catch (e: any) {
      Alert.alert("Erreur", e instanceof ApiError ? e.message : "L'achat a échoué");
    } finally {
      setBusy(null);
    }
  }

  function cancelIndividual() {
    Alert.alert(
      "Annuler le premium individuel",
      "Tu resteras premium jusqu'à la fin de la période déjà payée.",
      [
        { text: "Retour", style: "cancel" },
        {
          text: "Annuler l'abonnement",
          style: "destructive",
          onPress: async () => {
            setBusy("individual");
            try {
              await api.del("/purchases/individual");
              await Promise.all([load(), refreshMe()]);
            } catch (e: any) {
              Alert.alert("Erreur", e instanceof ApiError ? e.message : "L'annulation a échoué");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  async function buyGroup(calendarId: string) {
    if (!plans) return;
    const raw = seatsByCalendar[calendarId];
    const seats = raw ? parseInt(raw, 10) : plans.groupTiers[0].maxSeats;
    const period = periodByCalendar[calendarId] ?? "monthly";
    if (!seats || seats < 2 || seats > 300) {
      Alert.alert("Erreur", "Le nombre de places doit être entre 2 et 300.");
      return;
    }
    setBusy(calendarId);
    try {
      await api.post("/purchases/group", { calendarId, seats, period });
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", e instanceof ApiError ? e.message : "L'achat a échoué");
    } finally {
      setBusy(null);
    }
  }

  function cancelGroup(calendarId: string, calendarName: string) {
    Alert.alert(
      "Annuler le premium de ce calendrier",
      `"${calendarName}" restera premium jusqu'à la fin de la période déjà payée.`,
      [
        { text: "Retour", style: "cancel" },
        {
          text: "Annuler l'abonnement",
          style: "destructive",
          onPress: async () => {
            setBusy(calendarId);
            try {
              await api.del(`/purchases/group/${calendarId}`);
              await load();
            } catch (e: any) {
              Alert.alert("Erreur", e instanceof ApiError ? e.message : "L'annulation a échoué");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const visibleCalendars = focusedCalendarId
    ? calendars.filter((c) => c.id === focusedCalendarId)
    : calendars;
  const nonPremiumOwnedCalendars = visibleCalendars.filter((c) => !c.isPremium);
  const premiumOwnedCalendars = visibleCalendars.filter((c) => c.isPremium);
  const hasActiveOrTrialSub = !!status?.individual;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Premium",
          headerShown: true,
          headerRight: () => <HomeHeaderButton />,
          contentStyle: { paddingBottom: insets.bottom, backgroundColor: themeColors.background },
        }}
      />

      {loading || !plans ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: "red" }}>{error}</Text>
          <Pressable onPress={load} style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}>
            <Text>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
          <Text style={{ opacity: 0.6, fontSize: 12 }}>
            Mode bac à sable — aucun paiement réel n'est effectué.
          </Text>

          <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 }}>
            <Text style={{ fontWeight: "700" }}>Avantages premium</Text>
            {PREMIUM_FEATURES.map((f) => (
              <View key={f.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16 }}>{f.icon}</Text>
                <Text style={{ flex: 1 }}>{f.label}</Text>
              </View>
            ))}
            <Text style={{ opacity: 0.6, fontSize: 12, marginTop: 2 }}>
              Individuel : débloqué pour toi, sur tous tes calendriers. Groupe : débloqué pour tous
              les membres d'un calendrier précis.
            </Text>
          </View>

          {status?.trialAvailable && !hasActiveOrTrialSub ? (
            <Pressable
              onPress={startTrial}
              disabled={busy === "trial"}
              style={{ padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#fbbf24" }}
            >
              {busy === "trial" ? (
                <ActivityIndicator />
              ) : (
                <Text style={{ fontWeight: "700" }}>
                  Essayer premium gratuitement — {plans.trialDays} jours ✨
                </Text>
              )}
            </Pressable>
          ) : null}

          {status && status.referral.count > 0 ? (
            <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 }}>
              <Text style={{ fontWeight: "600" }}>Parrainage</Text>
              <Text style={{ opacity: 0.7 }}>
                {status.referral.rewardGranted
                  ? `${status.referral.count} personnes ont rejoint l'app grâce à toi — ${status.referral.rewardDays} jours de premium déjà offerts 🎉`
                  : `${status.referral.count}/${status.referral.threshold} — invite encore ${Math.max(0, status.referral.threshold - status.referral.count)} personne(s) pour ${status.referral.rewardDays} jours de premium offerts`}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Premium individuel ✨</Text>
            <Text style={{ opacity: 0.7 }}>Pour toi, partout où tu vas dans l'app.</Text>

            {status?.individual ? (
              <View style={{ padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 }}>
                <Text style={{ fontWeight: "600" }}>
                  {status.individual.provider === "trial" ? "Essai gratuit — " : ""}
                  {status.individual.canceledAt ? "Annulé — actif jusqu'au" : "Actif jusqu'au"}{" "}
                  {formatDateTime(status.individual.expiresAt)}
                </Text>
                {!status.individual.canceledAt && status.individual.provider !== "trial" ? (
                  <Pressable
                    onPress={cancelIndividual}
                    disabled={busy === "individual"}
                    style={{ padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, marginTop: 4 }}
                  >
                    {busy === "individual" ? <ActivityIndicator /> : <Text style={{ color: "red" }}>Annuler l'abonnement</Text>}
                  </Pressable>
                ) : null}
                {status.individual.provider === "trial" ? (
                  <Pressable
                    onPress={buyIndividual}
                    disabled={busy === "individual"}
                    style={{ padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, marginTop: 4 }}
                  >
                    <Text>Passer en abonnement payant — {formatPrice(plans.individual.priceCents)}/mois</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={buyIndividual}
                disabled={busy === "individual"}
                style={{ padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 }}
              >
                {busy === "individual" ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={{ fontWeight: "600" }}>
                    Passer premium — {formatPrice(plans.individual.priceCents)}/mois
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Premium groupe ✨</Text>
            <Text style={{ opacity: 0.7 }}>
              Pour tous les membres d'un calendrier. Choisis le palier adapté à sa taille.
            </Text>

            {premiumOwnedCalendars.length > 0 ? (
              <View style={{ gap: 8 }}>
                {premiumOwnedCalendars.map((cal) => {
                  const plan = status?.groupPlans.find((p) => p.calendarId === cal.id);
                  return (
                    <View key={cal.id} style={{ padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 }}>
                      <Text style={{ fontWeight: "600" }}>{cal.name}</Text>
                      <Text style={{ opacity: 0.7 }}>
                        {plan?.seats ?? "—"} places
                        {plan?.expiresAt
                          ? ` · ${plan.canceledAt ? "annulé — actif jusqu'au" : "actif jusqu'au"} ${formatDateTime(plan.expiresAt)}`
                          : ""}
                      </Text>
                      {plan && !plan.canceledAt ? (
                        <Pressable
                          onPress={() => cancelGroup(cal.id, cal.name)}
                          disabled={busy === cal.id}
                          style={{ padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, marginTop: 4 }}
                        >
                          {busy === cal.id ? <ActivityIndicator /> : <Text style={{ color: "red" }}>Annuler l'abonnement</Text>}
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {nonPremiumOwnedCalendars.length > 0 ? (
              <View style={{ gap: 14 }}>
                {nonPremiumOwnedCalendars.map((cal) => {
                  const seatsRaw = seatsByCalendar[cal.id] ?? String(plans.groupTiers[0].maxSeats);
                  const seats = parseInt(seatsRaw, 10) || 0;
                  const tier = tierForSeats(plans.groupTiers, seats);
                  const period = periodByCalendar[cal.id] ?? "monthly";
                  const price = tier
                    ? period === "annual"
                      ? tier.annualPriceCents
                      : tier.monthlyPriceCents
                    : null;

                  return (
                    <View key={cal.id} style={{ padding: 14, borderRadius: 12, borderWidth: 1, gap: 10 }}>
                      <Text style={{ fontWeight: "600", fontSize: 16 }}>{cal.name}</Text>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {plans.groupTiers.map((t) => {
                          const isSelected = tier?.id === t.id;
                          return (
                            <Pressable
                              key={t.id}
                              onPress={() =>
                                setSeatsByCalendar((prev) => ({ ...prev, [cal.id]: String(t.maxSeats) }))
                              }
                              style={{
                                flex: 1,
                                padding: 10,
                                borderRadius: 10,
                                borderWidth: isSelected ? 2 : 1,
                                borderColor: isSelected ? BRAND : undefined,
                                gap: 4,
                              }}
                            >
                              <Text style={{ fontWeight: "700", fontSize: 12 }}>{t.label}</Text>
                              <Text style={{ fontSize: 11, opacity: 0.7 }}>Jusqu'à {t.maxSeats} places</Text>
                              <Text style={{ fontWeight: "600" }}>{formatPrice(t.monthlyPriceCents)}/mois</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ opacity: 0.7 }}>Nombre exact de places :</Text>
                        <TextInput
                          value={seatsRaw}
                          onChangeText={(t) =>
                            setSeatsByCalendar((prev) => ({ ...prev, [cal.id]: t.replace(/[^0-9]/g, "") }))
                          }
                          keyboardType="number-pad"
                          style={{ borderWidth: 1, padding: 8, borderRadius: 8, width: 60 }}
                        />
                      </View>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={() => setPeriodByCalendar((prev) => ({ ...prev, [cal.id]: "monthly" }))}
                          style={{
                            flex: 1,
                            padding: 8,
                            borderRadius: 8,
                            alignItems: "center",
                            borderWidth: period === "monthly" ? 2 : 1,
                          }}
                        >
                          <Text>Mensuel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setPeriodByCalendar((prev) => ({ ...prev, [cal.id]: "annual" }))}
                          style={{
                            flex: 1,
                            padding: 8,
                            borderRadius: 8,
                            alignItems: "center",
                            borderWidth: period === "annual" ? 2 : 1,
                          }}
                        >
                          <Text>Annuel (2 mois offerts)</Text>
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => buyGroup(cal.id)}
                        disabled={busy === cal.id || !tier}
                        style={{ padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 }}
                      >
                        {busy === cal.id ? (
                          <ActivityIndicator />
                        ) : (
                          <Text style={{ fontWeight: "600" }}>
                            {tier
                              ? `Passer premium — ${formatPrice(price!)}${period === "annual" ? "/an" : "/mois"}`
                              : "Nombre de places invalide"}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {visibleCalendars.length === 0 ? (
              <Text style={{ opacity: 0.6 }}>
                Tu dois être propriétaire d'un calendrier pour lui acheter le premium groupe.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
