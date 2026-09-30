# SharedCalendars

Application de calendriers partagés : créer un ou plusieurs calendriers, inviter
des personnes dessus (famille, amis, club, équipe…), y organiser des
événements avec RSVP, sondages, photos et rappels — avec un modèle freemium
et des plans premium individuel/groupe.

Le projet est un monorepo à deux dossiers, sans outillage de workspace
(pas de `package.json` racine) :

```
api/      Backend NestJS + Prisma + PostgreSQL
mobile/   App Expo / React Native (expo-router), testée via Expo Go
```

## Fonctionnalités

- **Calendriers partagés** : membres avec rôles (Chef, Administrateur,
  Éditeur, Spectateur, Membre), invitation par lien (token, expire sous
  7 jours, réutilisable), thème/couleur par calendrier et couleur
  personnelle par membre, image de couverture (premium).
- **Événements** : description, lieu, horaires, commentaires, pièces
  jointes/photos, RSVP en français (OUI / PEUT-ÊTRE / NON), rappels,
  sondages (polls).
- **Import/export** : import d'événements Google Calendar (connexion
  OAuth depuis l'écran Profil, import depuis l'onglet Calendriers),
  lien ICS public par calendrier, export ponctuel ICS/CSV.
- **Statistiques** par calendrier : totaux, activité 7j/30j, top
  contributeurs.
- **Notifications** in-app avec préférences et compteur non-lus.
- **Mode sombre** complet (composants themed pour Text/View/Pressable/
  TextInput, palette dédiée, fond natif synchronisé pour éviter les
  flashs de transition).
- **Identité visuelle** : couleur de marque violet lavande (`#9683EC`),
  grille de calendrier mensuel avec swipe et transition animée entre
  mois, bannières colorées sur le dashboard et les listes.

## Modèle premium

- **Individuel** : 4,99 €/mois.
- **Groupe**, en 3 paliers de sièges avec tarif annuel : Famille & amis
  (≤15), Groupe étendu (≤50), Organisation — club/équipe/entreprise
  (≤300).
- **Essai gratuit** de 14 jours, une fois par compte.
- **Parrainage** : 3 filleuls réellement nouveaux (compte créé dans les
  72h suivant l'invitation) → 30 jours de premium offerts.
- **Limites freemium** : 2 calendriers créés max par compte gratuit,
  350 membres max par calendrier (plafond anti-abus au-dessus du plus
  gros palier de groupe).
- **Règle de dégradation** : tout contrôle premium se fait à la
  création/écriture, jamais à la lecture — en perdant le premium, un
  utilisateur garde l'accès à ce qu'il a déjà créé, seule la création
  de nouveau contenu au-delà des limites gratuites est bloquée.
- Le paiement est aujourd'hui un **sandbox** : `PurchasesService` passe
  par une interface `PaymentProvider`, actuellement implémentée par un
  `MockPaymentProvider`. Brancher un vrai fournisseur (IAP Apple/Google
  via RevenueCat, éventuellement Stripe pour le palier Organisation) ne
  nécessitera de changer que le binding DI dans `purchases.module.ts`.

## Démarrer en local

### Backend (`api/`)

```bash
cd api
npm install
```

Créer un fichier `.env` (non versionné) avec au minimum :

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
EXTERNAL_CALENDAR_SECRET=...
CORS_ORIGIN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
PUBLIC_API_URL=...
```

Puis :

```bash
npx prisma migrate dev
npm run start:dev
```

### Mobile (`mobile/`)

```bash
cd mobile
npm install
npx expo start
```

Ouvrir avec l'app **Expo Go** sur un téléphone physique (pas de
simulateur/émulateur dans ce workflow). Le backend n'étant pas exposé
publiquement en dev, adapter `API_BASE_URL` dans
`mobile/src/config/env.ts` avec l'IP locale du PC sur le réseau du
téléphone (`http://<IP_LAN>:3000`), sans quoi l'app ne pourra pas
joindre l'API depuis un appareil physique.

## Repère dans le code

- `api/src/purchases/` — plans, essai, parrainage, paiement (sandbox).
- `api/src/group-plans/` — abonnements de groupe, expiration (cron).
- `mobile/components/themed/` — remplaçants de `Text`/`View`/
  `Pressable`/`TextInput` avec couleurs adaptées au thème ; à utiliser
  partout à la place des composants `react-native` bruts.
- `mobile/src/lib/roles.ts`, `mobile/src/lib/rsvp.ts` — libellés
  français partagés (rôles, réponses RSVP).
- `mobile/src/lib/colors.ts` — couleur de marque.
