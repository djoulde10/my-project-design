

## Plan : Supprimer les sélecteurs de statut des PV

Le statut des PV suit un workflow automatique (Brouillon → Validé par le Président → Publié par le Secrétariat). Il n'y a pas de raison de permettre un choix manuel du statut.

### Changements

**1. `src/pages/Minutes.tsx`**
- Supprimer le bloc "Statut" (Select brouillon/validé) du formulaire de création de PV (lignes 102-111) — le PV sera toujours créé en "brouillon"
- Supprimer le bouton "Statut" dans la colonne Actions du tableau (lignes 195-198)
- Supprimer le Select inline de changement de statut dans la colonne Statut (lignes 170-177) — afficher uniquement le Badge en lecture seule
- Supprimer les états `editingId` et `editStatus` devenus inutiles
- Supprimer la fonction `updateStatus`

**2. `src/pages/Meetings.tsx`**
- Supprimer le bloc "Statut" (Select brouillon/validé) du formulaire de création de PV (lignes 944-953)
- Supprimer le Select inline de changement de statut dans le tableau (lignes 1003-1010) — afficher uniquement le Badge en lecture seule, sans `cursor-pointer` ni `onClick`
- Supprimer les états `editingStatusId` et `editStatus` devenus inutiles
- Supprimer la fonction `updateMinuteStatus`

### Résultat
Le statut sera affiché en lecture seule partout. Les PV seront toujours créés en "brouillon". La validation se fera par le Président et la publication par le Secrétariat via les boutons dédiés existants.

