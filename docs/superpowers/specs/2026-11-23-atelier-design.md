# Atelier — l'accueil de mes projets (document de conception)

_Rédigé le 23 novembre 2026, à partir de la conversation avec le propriétaire. État : **approuvé le 23 novembre 2026** (nom choisi : « Atelier »)._

---

## 1. Pourquoi

Le propriétaire bâtit beaucoup de projets avec l'aide d'IA (deux comptes Claude, un abonnement Google qui donne Antigravity; avant, ChatGPT/Codex). Avec le temps, il ne sait plus :

- quels projets existent vraiment : 11 dépôts GitHub pour environ 6 vrais projets. Le projet NBA est éparpillé dans 4 dépôts, dont un vide et un nommé « version-la-plus-avancer »; MonDroit.ca en a 2;
- où il est rendu dans chacun, et quand il y a touché pour la dernière fois;
- ce qui n'est pas sur GitHub (le serveur maison vit dans le dépôt de l'IPTV);
- quel compte IA il lui reste quand un quota est atteint, et quand les quotas reviennent.

Ses mots : « je suis vraiment comme perdu dans mes projets », « un manque de contrôle et de vision ».

**Réussite :** en ouvrant Atelier sur son téléphone ou son ordinateur, il a en 5 secondes la réponse à : « Qu'est-ce que j'ai comme projets, où j'en suis dans chacun, lesquels j'ai laissé traîner, et quel compte IA je peux utiliser maintenant? » Et il n'a rien à remplir pour que ça reste vrai.

## 2. Pour qui

Une seule personne, le propriétaire. Il n'est pas développeur. Il parle français du Québec. Il a un iPhone, un MacBook et un PC Windows. L'outil est privé.

**Surtout sur ordinateur.** Atelier est conçu pour l'écran d'ordinateur en premier. Le téléphone sert rarement : une version simplifiée (une colonne) suffit.

**Apparence choisie (23 novembre) : direction A, « Couleurs de projets ».** Maquettes : https://claude.ai/artifact/Ty9PkEvXW2hRNGBn8owqD6 (artboard « A · Couleurs de projets »).
- Fond blanc, beaucoup d'air, rien qui surcharge : on vient pour savoir où on en est.
- Vivant sans être chargé : chaque projet a sa couleur et une pastille (initiales); une phrase d'accueil en haut (« Bon retour. 3 projets avancent. »).
- Quotas IA dans trois bulles colorées en haut; endormis et idées en petites étiquettes en bas.
- Police Plus Jakarta Sans, coins très arrondis, ombres à peine visibles.

## 3. Objectifs

1. **Vue d'ensemble.** Tous les projets avec : statut, dernière activité (« hier », « il y a 8 mois »), avancement, dernière étape, prochaine étape et liens directs.
2. **Automatique.** Un nouveau dépôt GitHub apparaît tout seul (dans « À classer »). Les dates et les fiches se mettent à jour toutes seules, environ toutes les 15 minutes, et un bouton « Rafraîchir » force la mise à jour.
3. **Un projet n'est pas un dépôt.** On peut regrouper plusieurs dépôts sous un projet, et avoir des projets sans dépôt (serveur maison, idées).
4. **Idées en attente.** Des fiches grisées pour ne pas oublier une idée, qu'on note en 10 secondes, même du téléphone. Le jour où l'idée démarre, elle devient un projet et garde ses notes.
5. **Projets morts.** Des statuts clairs, la détection automatique des projets « endormis » et des archives. On peut masquer ce qu'on ne veut plus voir, sans rien perdre.
6. **Avancement en mélange.** L'IA du projet estime le pourcentage d'après son plan, le propriétaire peut le corriger, et sa correction gagne.
7. **Relais entre IA.** Chaque projet a une petite fiche standard (`ETAT.md`) avec un bloc « En cours », que les IA tiennent à jour. Quand un quota coupe le travail, une autre IA reprend sans rien perdre. Un bouton « Reprendre » copie la phrase de reprise.
8. **Quotas IA d'un coup d'œil.** Pour chaque compte (Claude 1, Claude 2, Google), on voit ce qui reste pour la session et pour la semaine, et quand ça se réinitialise. On voit aussi le compte le plus libre maintenant.
9. **Partout.** L'app est installable sur l'iPhone, le Mac et le PC, et protégée par un cadenas.

## 4. Non-objectifs (pas dans cette version)

- Les voyants « en ligne / en panne » des sites et du serveur maison : prévus pour la version 2.
- Les résumés par IA des vieux projets qui n'ont pas de fiche : version 2, peut-être jamais nécessaires.
- Les notifications, comme « ce projet s'endort » : version 2.
- L'historique ou le calendrier d'activité : version 2.
- Le dépôt entre appareils (idée 2) : un projet séparé, qui pourrait plus tard devenir un onglet d'Atelier.
- **Atelier n'écrit jamais dans les dépôts des projets.** Il lit GitHub, c'est tout. Les fiches `ETAT.md` sont écrites par les IA qui travaillent dans chaque projet.
- **Atelier ne touche jamais aux comptes IA.** Il n'utilise aucune connexion ni aucun jeton d'abonnement Claude ou Google, et il ne change jamais de compte automatiquement. C'est interdit par Anthropic et Google et ça peut faire perdre les comptes (voir la conversation du 23 novembre).
- Le partage avec d'autres personnes, ou plusieurs utilisateurs.

## 5. Anti-objectifs (échec même si « ça marche »)

- Atelier demande de l'entretien manuel pour rester juste : il prendrait alors du retard, comme la mémoire.
- Atelier invente des chiffres. Une valeur inconnue s'affiche « — » ou « À compléter », jamais 0 ni une estimation sortie de nulle part.
- Atelier est lent à ouvrir. Au-delà de 2 secondes sur le téléphone, il ne sera pas utilisé.
- Les projets privés fuient, y compris par l'adresse `workers.dev` si le cadenas peut être contourné.
- Les comptes IA du propriétaire sont mis en danger.
- La première version est si grosse qu'Atelier devient un projet abandonné de plus. Elle doit servir dès la première semaine.

## 6. Contraintes

- **Coût :** 0 $ de plus par mois. Le compte Cloudflare du propriétaire est déjà sur Workers Paid (5 $ US par mois, pour Pistes), et Atelier entre largement dans ce forfait. Pas de service payant à l'usage dans cette version.
- **Même recette que Pistes**, que les IA du propriétaire connaissent déjà : interface React + Vite, API Hono dans un Worker Cloudflare, base D1, validation zod, tests vitest et Playwright, en TypeScript. On réutilise le principe du cadenas de Pistes (`worker/acces.ts`).
- **GitHub :** une clé en **lecture seule** qui voit tous les dépôts du compte, présents et futurs (clé « fine-grained », _All repositories_, Metadata et Contents en lecture). Elle est gardée comme secret du Worker, jamais dans Git, jamais dans une conversation.
- **Règles du propriétaire :** interface en français du Québec, heures sur 24 h à l'heure de Montréal, virgule décimale. Toujours lui expliquer simplement et lui dire quoi tester. Messages de commit en français. Secrets jamais dans le chat.
- **iPhone :** c'est une app web installée sur l'écran d'accueil. Pas besoin du bouton « Partager » dans cette version.

## 7. Façons envisagées

### Hébergement (choisi par le propriétaire le 23 novembre : A)

| | Avantages | Inconvénients |
|---|---|---|
| **A. En ligne chez Cloudflare, comme Pistes** (choisie) | Accessible partout, rien à garder allumé, recette connue, gratuit dans le forfait actuel | Le serveur maison n'est pas joignable directement (seulement pour les voyants de la version 2) |
| B. Sur le serveur maison | Gratuit, proche des services maison | Joignable de l'extérieur seulement si on l'ouvre; si le serveur tombe, l'accueil tombe avec lui |
| C. Un outil tout fait (Notion, tableau GitHub) | Rien à bâtir | Tout est à la main, donc il prend du retard : ça va contre la raison d'être du projet |

### Quotas IA (mon choix, que le propriétaire peut corriger)

| | Décision |
|---|---|
| Claude : lire les chiffres que Claude Code fournit officiellement à sa barre d'état, et les envoyer à Atelier | **Choisi** |
| Claude : interroger le service d'Anthropic avec la connexion de l'abonnement | **Refusé** : c'est interdit, et ça met le compte en danger |
| Google : saisie rapide à la main | **Choisi** : il n'existe aucun moyen officiel |
| Google : extension non officielle qui lit le quota d'Antigravity | **Refusé** : zone grise, risque pour le compte |

## 8. Ce que le propriétaire voit

### 8.1 L'accueil (esquisse; l'apparence finale sera validée sur une maquette)

```
Atelier                                 lun. 23 nov. · à jour il y a 3 min  ⟳
QUOTAS IA
 Claude 1   session : reste 60 % (15 h 20) · semaine : reste 38 % (lun. 9 h)
 Claude 2   session : plein               · semaine : reste 82 % (jeu. 21 h)  ★ le plus libre
 Google     Gemini Pro : reste 60 % (dans 3 h) · Claude : bloqué (jeu.)   saisi il y a 2 h
À CLASSER (1)
 test        [Nouveau projet] [Rattacher à…] [Masquer]
EN COURS
 IPTV maison      hier         ▓▓▓▓▓▓▓░░░ 70 %   Prochaine : tester le filtre Sport sur la télé
 Pistes           il y a 2 j   ▓▓▓▓▓▓▓▓▓░ 98 %   Prochaine : recette en ligne (lot H)
 Appli sportive   il y a 2 j   —                 Dernière : termes sportifs du Québec
ENDORMIS : toujours en cours?
 MonDroit.ca      8 mois    2 dépôts   [En pause] [Abandonné] [Terminé]
 NBA              9 mois    4 dépôts   [En pause] [Abandonné] [Remplacé par…]
 Bot rendez-vous  10 mois              [En pause] [Abandonné] [Terminé]
IDÉES EN ATTENTE
 ░ Dépôt entre mes appareils    3/5    notée le 23 nov.            [+ Idée]
ARCHIVES (terminés, abandonnés, remplacés) ▸
```

- **Ordre :** quotas en haut, sur une ligne compacte par compte; puis « À classer » (seulement s'il y a quelque chose); puis En cours (le plus récent en premier), Endormis, Idées et Archives (repliées).
- **Une carte de projet** montre le nom, la dernière activité, l'avancement (une barre, ou « — »), la prochaine étape (ou la dernière, s'il n'y a pas de prochaine), le statut et une ou deux icônes de liens (site, GitHub). Un projet qui a un bloc « En cours » non vide porte la pastille « En cours de travail ».

### 8.2 Les autres écrans

- **Fiche projet :** tout ce qui précède, plus le bloc « En cours », la liste complète des liens (modifiable), les dépôts rattachés (rattacher, détacher, choisir le dépôt principal), le statut et l'avancement (modifiables), les propositions de l'IA (accepter ou ignorer), des notes libres, les 5 derniers commits et le bouton **« Reprendre »**.
- **À classer :** pour chaque nouveau dépôt, trois choix : « Nouveau projet », « Rattacher à… » (un projet existant ou une idée) et « Masquer ».
- **Nouvelle idée :** un titre et des notes, rien d'autre d'obligatoire.
- **Quotas :** le détail par compte, la saisie rapide pour Google, la correspondance entre les comptes Claude et leurs noms (« Claude 1 », « Claude 2 ») et l'heure de la dernière mise à jour.
- **Réglages :** les éléments masqués (avec « Réafficher »), le seuil « endormi » (30 jours par défaut) et la liste des comptes IA.

## 9. Comment ça marche

### 9.1 Projets et dépôts

- Un dépôt est reconnu par son identifiant GitHub, ce qui survit à un changement de nom. Il appartient à **au plus un** projet, ou il est masqué.
- Un dépôt nouveau n'est **jamais** rattaché automatiquement : il va dans « À classer ».
- Rattacher un dépôt à une idée en fait un projet « En cours » qui garde ses notes.
- Un projet a un nom, un statut, des notes, des liens, de 0 à n dépôts et un **dépôt principal** qui fournit la fiche. Par défaut, c'est le dépôt qui a une fiche et le dernier `push`; sinon, le dernier `push`.
- **Dernière activité** d'un projet : le `push` le plus récent parmi ses dépôts, toutes branches confondues. Pour un projet sans dépôt, c'est la date de sa dernière modification dans Atelier, marquée « (à la main) ».
- Un dépôt supprimé sur GitHub est marqué « disparu » sur son projet. Il n'est jamais effacé en silence.
- **Masquer** cache un projet ou un dépôt de l'accueil, et on peut le réafficher. **Supprimer** n'existe que pour ce qui vit seulement dans Atelier (une idée, un projet sans dépôt), avec confirmation. Atelier ne supprime jamais rien sur GitHub.

### 9.2 Statuts

- **Les statuts possibles :** Idée, En cours, En pause, Terminé, Abandonné, Remplacé par (un autre projet).
- **« Endormi » n'est pas un statut, c'est une pastille calculée :** le projet est « En cours » mais n'a pas eu d'activité depuis plus de 30 jours (seuil réglable). Il apparaît dans « Endormis », avec des boutons pour décider.
- **Qui décide :** le choix du propriétaire dans Atelier gagne toujours. Le `statut` de la fiche est une **proposition** :
  - il remplit un statut vide;
  - s'il diffère plus tard du choix du propriétaire, Atelier affiche « Ton IA propose : Terminé », avec Accepter et Ignorer;
  - une proposition ignorée ne revient que si la fiche change encore de valeur.

### 9.3 Avancement

- Même règle que le statut : la valeur du propriétaire gagne, et l'`avancement` de la fiche est une proposition (« L'IA propose 80 % »).
- Inconnu = « — ». Jamais 0 par défaut.
- L'IA du projet l'estime d'après le plan (étapes faites sur étapes prévues), arrondi à 5 %.

### 9.4 La fiche `ETAT.md` : le relais entre IA et la source d'Atelier

Un petit fichier à la racine de chaque dépôt, lisible par un humain comme par Atelier :

```markdown
---
projet: IPTV maison
statut: en cours          # idée | en cours | en pause | terminé | abandonné
avancement: 70            # 0 à 100, estimé d'après le plan, arrondi à 5
derniere_etape: Version ordinateur de la page web corrigée et mise en ligne
prochaine_etape: Tester le filtre Sport « En direct » sur la télé du salon
mis_a_jour: 2026-11-22 18:49
par: Claude Code (compte 2)
liens:
  - Site: https://iptv-home-config.vercel.app/
---

## En cours
- Ce que je fais : …
- Déjà fait dans cette étape : …
- Prochaine action précise : …
- Fichiers et commandes utiles : …
(Vide quand aucune étape n'est en cours.)
```

**La règle à ajouter en haut des consignes de chaque projet** (`CLAUDE.md`, `AGENTS.md`) :

> **Fiche ETAT.md (priorité haute).**
> - Après chaque petit pas, mets à jour la section « En cours » d'`ETAT.md` : ce que tu fais, ce qui est fait et la prochaine action précise.
> - À la fin de chaque étape validée, mets à jour l'en-tête (statut, avancement estimé d'après le plan, dernière étape, prochaine étape, date, ton nom et ton outil), puis vide « En cours ».
> - Respecte les règles de commit de ce projet : la fiche part sur GitHub avec le prochain commit. Dans un environnement temporaire (session dans le nuage), pousse ta branche de travail avant de t'arrêter.
> - Si on te dit « Reprends », lis `ETAT.md` (« En cours »), puis `PASSATION.md` s'il existe, et continue.

**Comment Atelier lit la fiche :**
- Atelier lit `ETAT.md` sur la **branche principale** du dépôt principal, et seulement quand le dépôt a changé depuis la dernière lecture.
- Une fiche absente ne pose pas de problème : la carte affiche seulement ce que GitHub sait.
- Une fiche illisible ou incomplète affiche la pastille « Fiche à vérifier ». Atelier garde alors les dernières bonnes valeurs et ne plante jamais.
- Les valeurs de `statut` sont comparées sans tenir compte des accents ni des majuscules.

**Pourquoi « En cours » n'est pas poussé après chaque petit pas :** certains projets interdisent de pousser avant la validation du propriétaire (l'appli sportive : « Oui, enregistre »). Sur un même ordinateur, l'IA suivante lit le fichier sur le disque, donc le relais fonctionne sans pousser.

### 9.5 Le bouton « Reprendre »

Il copie dans le presse-papiers :
« Reprends le projet {nom} (dépôt {propriétaire/dépôt}). Lis d'abord `ETAT.md` (section « En cours »), puis `PASSATION.md` s'il existe, et continue là où le travail s'est arrêté. »

La phrase fonctionne dans n'importe quel outil : Claude Code sur l'un ou l'autre compte, Antigravity, etc.

### 9.6 Quotas IA

**Comptes :**
- La liste est modifiable, et elle commence avec « Claude 1 », « Claude 2 » et « Google (Antigravity) ».
- Chaque compte a un nom, un type (Claude, Google ou autre), un forfait et des notes.

**Claude (automatique) :**
- La barre d'état de Claude Code reçoit officiellement, pour les forfaits Pro et Max, `rate_limits.five_hour` et `rate_limits.seven_day`, chacun avec `used_percentage` et `resets_at` (heure de réinitialisation). Ces champs sont parfois absents, d'où la vérification de l'étape 0.
- Un petit script, installé une fois sur chaque ordinateur où le propriétaire utilise Claude Code (le Mac et le PC Windows), affiche une barre d'état normale et envoie ces chiffres à Atelier. Il les envoie au plus une fois par minute, et seulement s'ils ont changé.
- Le script indique aussi **quel compte** est actif sur cet ordinateur à ce moment-là, puisque le propriétaire change de compte sur un même ordinateur. Le constructeur choisit une façon fiable de le savoir, par exemple le courriel du compte connecté dans la configuration locale de Claude Code. Le propriétaire associe chaque courriel à un nom une seule fois dans Atelier.
- **Le script n'envoie et ne lit jamais de jeton de connexion.**
- L'usage sur claude.ai et dans l'app compte dans les mêmes limites. Les chiffres d'Atelier se rafraîchissent chaque fois que Claude Code tourne sur un des ordinateurs. Les sessions de Claude Code dans le nuage ne sont pas couvertes par cette version.

**Google / Antigravity (à la main) :**
- Une saisie rapide par groupe de modèles (par exemple « Gemini Pro », « Claude dans Antigravity ») : ce qui reste (en % ou « bloqué ») et dans combien de temps ça revient (heures ou jours).
- Atelier transforme « dans combien de temps » en heure de réinitialisation.

**Affichage :**
- Atelier affiche **ce qui reste**, c'est-à-dire 100 moins le % utilisé, avec la réinitialisation en compte à rebours et en heure de Montréal, et la mention « mis à jour il y a… ».
- Une fois l'heure de réinitialisation passée, Atelier affiche tout seul « réinitialisé, plein », sans attendre de nouveaux chiffres.
- Des chiffres de plus de 24 h dont la réinitialisation n'est pas encore passée sont grisés, avec la mention « à confirmer ».
- **« ★ le plus libre » :** c'est le compte qui a le plus de marge dans sa session de 5 h, puis dans sa semaine. C'est une simple indication : Atelier ne change jamais de compte lui-même.

### 9.7 Liens

- Chaque projet a une liste modifiable de liens (un nom et une adresse).
- Elle est préremplie avec l'adresse GitHub de chaque dépôt, le champ « site » du dépôt sur GitHub et les `liens` de la fiche.

### 9.8 Synchronisation avec GitHub

- Une minuterie toutes les 15 minutes, et le bouton « Rafraîchir ».
- Chaque passage :
  - liste tous les dépôts du compte (y compris les privés et les archivés);
  - ajoute les nouveaux dans « À classer »;
  - met à jour les dates;
  - relit les fiches des dépôts qui ont changé, et récupère leurs 5 derniers commits.
- Si GitHub est injoignable ou que la clé ne marche plus, Atelier affiche les dernières données connues avec un bandeau clair (« GitHub injoignable depuis 14 h 05 », « clé GitHub refusée : à renouveler »). Rien n'est effacé.

## 10. Données de départ

C'est ma proposition. Le propriétaire corrige ensuite tout dans l'app.

| Projet | Dépôts | Note |
|---|---|---|
| IPTV maison | iptv-home | Lien vers le site web |
| Serveur maison | aucun | Son code vit dans iptv-home (`apps/server`); fiche à la main |
| Pistes | pistes | |
| Appli sportive | appli-sportive | Lien vers le site |
| MonDroit.ca | mondroit-ca, v0-MonDroit.ca | |
| NBA | nba-betting-app, nba-app-BONNE-ESPOIR, v0-live-nba-scores, V0-version-7-24-fevrier-version-la-plus-avancer | Le propriétaire décidera s'il est « remplacé par » l'appli sportive |
| Bot rendez-vous médecin | bot-rdv-medecin | |
| (à classer) | test | |

- **Idée :** « Dépôt entre mes appareils », avec la fiche de la conversation en notes : 3 sur 5; boîte de dépôt ultra rapide; canaux comme simples tiroirs; contournement du bouton Partager de l'iPhone par un Raccourci; vidéos lourdes; même recette que Pistes.
- **Statuts de départ :** « En cours » partout. Les vieux projets tomberont donc dans « Endormis », où le propriétaire décidera.
- **Comptes IA :** Claude 1, Claude 2 et Google (Antigravity).

## 11. Sécurité

- **Cadenas :** Cloudflare Access sur l'adresse `workers.dev`, comme Pistes (« Enable Cloudflare Access », le courriel du propriétaire seulement). De plus, le Worker vérifie lui-même le jeton d'Access à chaque requête, avec le même principe que `worker/acces.ts` de Pistes, pour qu'on ne puisse pas contourner le cadenas.
- **Durée de session longue** (par exemple 1 mois) pour ne pas redemander le code à tout moment sur l'iPhone. À vérifier à l'étape 0.
- **L'entrée des quotas** (le script des ordinateurs) a sa propre clé, gardée seulement sur les ordinateurs du propriétaire. Elle ne permet **que** d'écrire des chiffres de quota.
- **La clé GitHub** est en lecture seule et gardée comme secret du Worker.
- **Dépôts publics :** une fiche `ETAT.md` dans un dépôt public (iptv-home) est publique, comme sa `PASSATION.md` l'est déjà. Jamais de secrets ni de données personnelles dans une fiche.

## 12. Mise en ligne et entretien

- **Un nouveau dépôt GitHub privé `atelier`**, créé avec l'accord du propriétaire.
- **Tous les dépôts sont sur un seul compte GitHub personnel** (vérifié le 23 novembre : les 11 dépôts appartiennent au même compte, aucune organisation). Une seule clé GitHub suffit.
- **Publication par GitHub Actions** à chaque `push` sur `main`, comme l'appli sportive, après les tests. Le propriétaire ajoute le secret `CLOUDFLARE_API_TOKEN`, guidé pas à pas.
- **Migrations D1 numérotées, appliquées par la publication.** On ne modifie jamais une migration déjà appliquée; on en ajoute une nouvelle. Les migrations ne font qu'ajouter (jamais supprimer une colonne ni des données), et la publication note avant chaque migration un signet Time Travel de D1 (retour en arrière possible sur 30 jours). Contrairement à Pistes, pas de base d'essai : les données d'Atelier sont petites et en grande partie reconstruites depuis GitHub.
- **Atelier suit ses propres règles :** il a sa `PASSATION.md`, sa fiche `ETAT.md` et ses consignes `CLAUDE.md`/`AGENTS.md`, avec la règle de la fiche.

## 13. Ordre de construction

0. **Deux vérifications rapides, avant de bâtir le reste :**
   - le cadenas Cloudflare Access fonctionne dans l'app installée sur l'écran d'accueil de l'iPhone, avec une session qui dure. **Si ça échoue :** Atelier s'utilise sur l'iPhone dans un onglet Safari ordinaire (en favori), avec le même cadenas. On n'invente pas un deuxième système de connexion;
   - la barre d'état de Claude Code reçoit bien les champs de quota sur le Mac et le PC du propriétaire. **Si ça échoue** (sur un ordinateur ou un compte) : les comptes Claude passent en saisie rapide à la main, comme Google, et le script attend une version de Claude Code qui fournit les champs.
1. **Première version utilisable (le but : la première semaine) :**
   - accueil, fiches projets, « À classer », statuts et endormis, masquer, liens;
   - synchronisation automatique, cadenas, app installable;
   - lecture des fiches `ETAT.md`, avancement et statut avec les propositions de l'IA, bouton « Reprendre »;
   - idées en attente.

   **Une maquette de l'accueil est montrée au propriétaire et validée avant de construire l'écran.**
2. **Quotas IA :**
   - le panneau et la saisie rapide pour Google;
   - l'entrée sécurisée;
   - le script de barre d'état, installé sur le Mac et le PC.
3. **Adoption du relais :** ajouter `ETAT.md` et la règle dans les trois projets actifs (iptv-home, pistes, appli-sportive), **un projet à la fois, avec l'accord du propriétaire, en respectant les règles de chaque projet** (Pistes : un seul constructeur à la fois; appli sportive : commit seulement après « Oui, enregistre »).
4. **Plus tard (version 2) :** les voyants en ligne/en panne, les résumés IA des vieux projets, les notifications, l'historique d'activité et le dépôt entre appareils.

## 14. Laissé au constructeur

- Le schéma exact de la base, les routes de l'API et le détail de la synchronisation (pagination, en-têtes de cache de GitHub).
- La lecture de la fiche, et les composants et styles de l'interface (après la validation de la maquette).
- Les tests.
- La façon fiable de reconnaître le compte Claude actif sur un ordinateur.
- La façon de faire tourner le script sur Windows et sur Mac.
- Les réglages d'Access.
- Le mécanisme exact de la clé de l'entrée des quotas : un jeton de service Access, ou une clé propre à Atelier.

## 15. Choix faits par Claude (à vérifier par le propriétaire en lisant)

- (Nom choisi par le propriétaire : « Atelier ».)
- Le seuil « endormi » à 30 jours (réglable).
- Une synchronisation toutes les 15 minutes.
- Le nom de la fiche (`ETAT.md`), son format, et le fait que « En cours » suive les règles de commit de chaque projet.
- Le serveur maison comme projet à part, sans dépôt.
- Des quotas affichés en « ce qui reste » plutôt qu'en « utilisé ».
- La fiche lue sur la branche principale seulement.
- La publication par GitHub Actions à chaque `push`, avec migrations automatiques protégées par un signet Time Travel.
- Les solutions de repli si une vérification de l'étape 0 échoue (Safari ordinaire; saisie à la main pour Claude).
