# Refundit — Palette & Typographie

*Guide de référence pour le site web et l'app mobile · v1 · novembre 2026*

---

## 1. Intention

Refundit doit se lire en une seconde : **simple, ça fait gagner du temps, ça fait gagner de l'argent**. Le ton est complice, avec une pointe d'humour.

La direction artistique repose sur trois idées :

- **Le papier du ticket de caisse.** Des fonds crème chauds, une encre presque noire et une police monospace pour les montants.
- **Le vert de la pastille ✓.** C'est la seule couleur de marque. Elle veut dire « c'est validé, c'est remboursé ».
- **Des pastels granuleux.** Chaque étape du parcours a son ambiance colorée, avec un grain léger qui donne un côté imprimé et chaleureux.

> Règle d'or : le vert est **rare**. Il sert au logo, au bouton principal et à l'argent récupéré. Partout ailleurs, on reste en encre sur crème.

---

## 2. Couleur de marque

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Marque | **Vert Refundit** | `#22C55E` | Pastille ✓ du logo, bouton principal, statut Remboursé. Toujours en aplat. |
| Texte sur vert | Vert nuit | `#0B1F12` | Texte et icônes posés sur le vert (contraste 7,5:1). **Jamais de blanc sur le vert.** |
| Vert texte | Vert profond | `#15803D` | Liens, montants récupérés, petits textes verts sur fond clair (≥ 4,6:1). |
| Fond vert | Vert menthe | `#DCFCE7` | Ligne cochée du ticket, badge Remboursé, toast de succès. |
| Texte sur fond vert | Vert forêt | `#166534` | Texte posé sur le vert menthe (≥ 6,4:1). |
| Vert sur fond sombre | Vert néon doux | `#4ADE80` | Montants sur la carte noire du suivi, scanline, anneau de focus en sombre. |

---

## 3. Neutres

Les neutres ne sont **jamais gris purs**. Ils tirent légèrement vers le vert-brun pour rester dans la famille du papier et de la pastille.

| Rôle | Hex (clair) | Hex (sombre) | Usage |
|---|---|---|---|
| `surface` — fond de page | `#F8F7F2` | `#0F1412` | Blanc cassé chaud, couleur du papier. |
| `surface-raised` — cartes | `#FFFFFF` | `#18201C` | Cartes, ticket redessiné, modales. |
| `surface-sunken` — creux | `#EFEDE5` | `#0A0E0C` | Zone de scan, piste des barres de progression. |
| `line` — séparateur | `#E3E1D8` | `#2A332E` | Lignes du ticket, bordures décoratives. |
| `line-strong` — contour | `#8A8F88` | `#6B746E` | Bordure des champs, cases à cocher, boutons secondaires (3:1). |
| `ink` — texte principal | `#111714` | `#F2F4F1` | Titres, texte, boutons pleins noirs. |
| `ink-muted` — texte secondaire | `#5B635E` | `#A4ADA7` | Légendes, métadonnées, sous-titres (≥ 5,7:1). |

---

## 4. Couleurs de statut

Chaque statut a trois teintes : une couleur forte (point, barre, icône), un fond doux (badge) et un texte lisible sur ce fond.

| Statut | Forte | Fond doux | Texte sur fond | Quand |
|---|---|---|---|---|
| **Remboursé** | `#22C55E` | `#DCFCE7` | `#166534` | L'argent est arrivé. |
| **En cours** | `#1D4ED8` | `#DBEAFE` | `#1D4ED8` | Un agent travaille, réclamation envoyée ou lue. |
| **Besoin de toi** | `#F59E0B` | `#FEF3C7` | `#92400E` | L'agent attend une validation, une photo, un CAPTCHA. |
| **Refusé / Stop** | `#C81E1E` | `#FEE2E2` | `#B91C1C` | Refus de la marque, agent arrêté, erreur. |

En mode sombre : En cours `#60A5FA`, Besoin de toi `#FBBF24`, Refusé `#F87171`, avec des fonds doux foncés (`#172554`, `#3A2A0E`, `#3A1717`).

---

## 5. Panneaux pastel (ambiance par étape)

C'est la signature visuelle du site. Chaque panneau combine **un dégradé vertical de base**, **une grande lueur radiale en bas à droite** (≈ 86 % / 80 %) et **une lueur plus douce en bas à gauche**. Un grain fin passe par-dessus.

| Étape | Ambiance | Dégradé de base | Lueur |
|---|---|---|---|
| **Scanne** | Citron crème | `#F3EEDC` → `#F6EBC0` | `rgb(246, 214, 90)` |
| **Coche** | Menthe sauge | `#E8F1E4` → `#D7EED4` | `rgb(110, 214, 140)` |
| **Réclame** · Agents | Bleu brume | `#E6ECF4` → `#D7E4F5` | `rgb(120, 170, 240)` |
| **Récupère** · Suivi | Pêche abricot | `#F8DFCB` → `#F9CBA9` | `rgb(249, 150, 84)` |

**Grain :** bruit fractal SVG (`feTurbulence`, fréquence 0,85, 3 octaves), opacité **18 %**, mode de fusion `multiply`.

**Transition :** fondu enchaîné de **0,77 s** entre deux panneaux, pour passer par un mélange doux et non par un cut.

```css
.panel-scan {
  background:
    radial-gradient(60% 55% at 86% 80%, rgba(246,214,90,.85), transparent 70%),
    radial-gradient(50% 45% at 20% 105%, rgba(246,214,90,.45), transparent 70%),
    linear-gradient(180deg, #F3EEDC, #F6EBC0);
}
```

---

## 6. Icônes 3D brillantes

Les quatre verbes ont chacun une icône « bonbon gonflé » dans la teinte de leur panneau. Elles sont construites avec un dégradé radial à trois arrêts (reflet → couleur → ombre) et un reflet blanc en haut à gauche.

| Icône | Verbe | Reflet | Cœur | Ombre |
|---|---|---|---|---|
| Ticket | Scanne | `#FFF2A8` | `#F2C21B` | `#B88700` |
| Coche ronde | Coche | `#B8F7CE` | `#22C55E` | `#127A39` |
| Bulle « ! » / robot | Réclame | `#CFE1FF` | `#4C8DF6` | `#1D4ED8` |
| Pièce € | Récupère | `#FFD7B8` | `#F2772F` | `#C2410C` |

Reflet commun : blanc à 90 % → 0 %, centré à 34 % / 22 %. Une ombre portée douce (`rgba(17,23,20,.16)`) les détache du fond.

---

## 7. Typographie

### Plus Jakarta Sans — la voix de Refundit

Une grotesque géométrique contemporaine, dessinée à Jakarta (Tokotype). Elle a des formes rondes et ouvertes, un « a » amical et des terminaisons nettes. Elle est **chaleureuse sans être enfantine**, et **sérieuse sans être bancaire**, exactement l'équilibre recherché pour une app qui parle d'argent avec humour.

- **Rôle :** titres, textes, boutons, interface.
- **Graisses utilisées :** 400 (texte), 500 (chapeaux), 600 (labels), **700 (titres et logo)**, 800 (display).
- **Signature :** les grands titres sont **très serrés** (interlignage 0,9, approche −0,035 em). Ça donne l'effet « affiche » du hero.
- **Source :** Google Fonts, licence OFL (libre, usage commercial OK).
- **Repli :** `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif`

### JetBrains Mono — la voix du ticket

Une monospace à chasse fixe, très lisible, avec des chiffres bien différenciés (0 barré léger, 1 avec empattement). Elle rappelle **l'impression thermique d'un ticket de caisse** et aligne naturellement les montants en colonne.

- **Rôle :** lignes du ticket, prix, montants, codes de bon d'achat, URL de l'agent, dates du suivi.
- **Graisses utilisées :** 400 (ticket), 600 (montants).
- **Règle :** **tout montant en euros est en mono.** C'est ce qui rend l'argent immédiatement repérable.
- **Source :** Google Fonts, licence OFL.
- **Repli :** `"JetBrains Mono", ui-monospace, Menlo, monospace`

### Échelle typographique

| Style | Police | Taille / interlignage | Graisse | Approche | Usage |
|---|---|---|---|---|---|
| Hero | Jakarta | 172 / 148 px (desktop) | 700 | −0,032 em | « Scanne / Coche / Réclame / Récupère » |
| Display | Jakarta | 56 / 60 px | 800 | −0,03 em | Grands titres de section |
| H1 app | Jakarta | 44 / 40 px (mobile) | 700 | −0,035 em | Titre de chaque écran avec son icône |
| H1 | Jakarta | 40 / 46 px | 700 | −0,02 em | Titres de page desktop |
| H2 | Jakarta | 28 / 34 px | 700 | −0,01 em | Sous-sections |
| H3 | Jakarta | 20 / 28 px | 700 | — | Titres de cartes |
| Chapeau | Jakarta | 18 / 28 px | 500 | — | Phrase sous un titre, en `ink-muted` |
| Corps | Jakarta | 16 / 24 px | 400 | — | Texte courant (**16 px minimum sur mobile**) |
| Label | Jakarta | 14 / 20 px | 600 | — | Boutons, champs, onglets |
| Surtitre | Jakarta | 12 / 16 px | 700 | +0,08 em, majuscules | « RÉCUPÉRÉ AU TOTAL », en-tête du ticket |
| Montant | Mono | 20 / 28 px (jusqu'à 46 px) | 600 | — | Montant en jeu, total récupéré |
| Ticket | Mono | 14 / 22 px | 400 | — | Lignes de produits |

---

## 8. Règles d'usage

**À faire**
- Encre sur crème pour 90 % de l'interface, vert pour l'action principale et l'argent gagné.
- Un seul bouton plein par écran : noir (`ink`) pour avancer, vert pour la victoire finale.
- Montants toujours en JetBrains Mono, en vert profond quand ils sont gagnés.
- Arrondis généreux : 14 px pour les boutons, 20 à 28 px pour les cartes, pilule pour les badges.

**À éviter**
- Du blanc sur le vert `#22C55E` (illisible).
- Le vert pour un simple texte décoratif ou un titre.
- Des gris neutres froids (`#999`, `#CCC`) : ils cassent la chaleur du papier.
- Plus d'une ambiance pastel visible en même temps.
- Les logos de vraies marques dans les visuels marketing : utiliser des produits génériques.

---

## 9. Variables CSS prêtes à l'emploi

```css
:root {
  /* Marque */
  --brand: #22C55E;
  --on-brand: #0B1F12;
  --brand-strong: #15803D;
  --brand-soft: #DCFCE7;
  --on-brand-soft: #166534;

  /* Neutres */
  --surface: #F8F7F2;
  --surface-raised: #FFFFFF;
  --surface-sunken: #EFEDE5;
  --line: #E3E1D8;
  --line-strong: #8A8F88;
  --ink: #111714;
  --ink-muted: #5B635E;

  /* Statuts */
  --info: #1D4ED8;        --info-soft: #DBEAFE;
  --warning: #F59E0B;     --warning-soft: #FEF3C7;   --on-warning-soft: #92400E;
  --danger: #C81E1E;      --danger-soft: #FEE2E2;    --on-danger-soft: #B91C1C;

  /* Typo */
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;

  /* Formes */
  --radius-sm: 8px;  --radius-md: 14px;  --radius-lg: 20px;  --radius-xl: 28px;  --radius-pill: 999px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand: #2EDB6E;  --on-brand: #06140B;  --brand-strong: #4ADE80;
    --brand-soft: #12301E;  --on-brand-soft: #86EFAC;
    --surface: #0F1412;  --surface-raised: #18201C;  --surface-sunken: #0A0E0C;
    --line: #2A332E;  --line-strong: #6B746E;
    --ink: #F2F4F1;  --ink-muted: #A4ADA7;
    --info: #60A5FA;  --info-soft: #172554;
    --warning: #FBBF24;  --warning-soft: #3A2A0E;  --on-warning-soft: #FCD34D;
    --danger: #F87171;  --danger-soft: #3A1717;  --on-danger-soft: #FCA5A5;
  }
}
```

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap">
```
