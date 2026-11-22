# ProjetAssos en production

La pile `projetassos-production` utilise des réseaux et des volumes distincts du développement. Caddy sert React et transmet `/api` à NestJS sur le même domaine. Seul Caddy publie des ports. PostgreSQL, NestJS et les médias restent sur les réseaux ou volumes Docker.

## Préparer l’hôte

- Installer Docker Engine et le plugin Compose v2 sur un hôte Linux. Publier l’enregistrement DNS du domaine vers cet hôte. Ouvrir TCP 80 et 443, et UDP 443 pour HTTP/3. Caddy obtient et renouvelle automatiquement les certificats. Conserver ses volumes `/data` et `/config`.
- Créer `.env.production` à partir de [l’exemple](../.env.production.example). Restreindre ce fichier à `0600`. Choisir un domaine et un e-mail ACME valides. Générer trois secrets indépendants avec `openssl rand -hex 32`. Renseigner SMTP et l’expéditeur avant l’invitation du premier administrateur. Configurer Google si utilisé.
- Si le réseau Docker `172.30.72.0/24` chevauche un réseau de l’hôte, modifier ensemble `EDGE_SUBNET`, `EDGE_IP_RANGE` et `EDGE_IP`. `EDGE_IP` doit rester dans le sous-réseau mais hors de `EDGE_IP_RANGE`, réservée aux adresses dynamiques. Caddy remplace l’en-tête d’IP transmis à l’API. NestJS fait confiance à la seule IP de Caddy configurée par Compose. Si un CDN ou un autre proxy précède Caddy, adapter la chaîne de confiance et vérifier la limite par IP depuis deux clients avant ouverture.
- `FRONT_ORIGIN` et `API_ORIGIN` ciblent le même domaine HTTPS. Les cookies gardent `HttpOnly`, `SameSite=Lax` et `Secure`. Si Google est activé, déclarer `https://<domaine>/api/v1/auth/google/callback` comme URI de redirection. Pour SMTP, utiliser TLS direct ou STARTTLS.

## Premier démarrage

Depuis le répertoire du projet, définir la commande dédiée à la production. Utiliser un fichier de variables distinct de celui du développement.

```sh
dc() { docker compose -p projetassos-production --env-file .env.production -f compose.production.yaml "$@"; }
dc --profile operations config --quiet
dc --profile operations build back front migrate
dc up -d --wait db
dc run --rm --no-deps migrate
dc up -d --wait back front
```

Le volume PostgreSQL 18 est monté sur `/var/lib/postgresql`. Son initialisation crée le compte `projetassos_app`, propriétaire de cette base et sans privilège superutilisateur. L’application et le conteneur Prisma utilisent ce compte. Modifier `.env.production` seul ne change pas les mots de passe d’un cluster déjà initialisé.

Le service ponctuel `migrate` exécute `prisma migrate deploy` avec la configuration et les fichiers du dépôt. Attendre son succès avant de démarrer l’API. Après le démarrage, vérifier `dc ps` et `curl -fsS https://<domaine>/api/v1/health`.

Si aucun administrateur n’existe, utiliser l’invitation existante.

```sh
export BOOTSTRAP_ADMIN_EMAIL=admin@example.org
export BOOTSTRAP_ADMIN_FIRST_NAME=Prenom
export BOOTSTRAP_ADMIN_LAST_NAME=Nom
dc run --rm --no-deps -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_FIRST_NAME -e BOOTSTRAP_ADMIN_LAST_NAME back node dist/src/bootstrap-admin.js
```

## Sauvegarder et mettre à jour

Préparer un répertoire privé `0700`, appartenant au compte d’exploitation, hors du dépôt et sur un stockage chiffré. Le script Linux exige Docker Compose, `flock`, `tar` et `sha256sum`.

```sh
BACKUP_DIR=/srv/projetassos-backups bash deploy/backup.sh
```

Le script suspend brièvement l’API si elle tourne. Il crée un dump PostgreSQL au format personnalisé et une archive de `/app/storage`. Il vérifie qu’ils sont lisibles, écrit leurs empreintes SHA-256 puis redémarre l’API si elle tournait. `PROD_ENV_FILE` permet d’utiliser un fichier de variables hors du dépôt. Éviter toute migration ou écriture manuelle pendant la sauvegarde. Conserver une copie chiffrée hors hôte et fixer la fréquence et la rétention avec le responsable des données.

Pour une mise à jour, exécuter dans cet ordre. Poursuivre seulement après le succès de chaque commande.

```sh
dc --profile operations build back front migrate
dc stop back
BACKUP_DIR=/srv/projetassos-backups bash deploy/backup.sh
dc run --rm --no-deps migrate
dc up -d --wait back front
```

Si une migration échoue, garder l’API arrêtée le temps du diagnostic. Préparer une restauration sur une destination vide en cas de retour arrière.

## Restaurer sur une destination dédiée

Utiliser un hôte de récupération ou une installation de production neuve, avec une base et un volume médias vides. Le même projet Compose sur le même hôte réutilise les volumes existants. Démarrer uniquement `db` et garder `back` et `front` arrêtés jusqu’aux contrôles. Utiliser une archive issue d’une source de confiance.

```sh
set -e
backup=/srv/projetassos-backups/projetassos-HORODATAGE
(cd "$backup" && sha256sum -c SHA256SUMS)
dc up -d --wait db
test -z "$(dc ps --status running -q back front)"
test "$(dc exec -T db psql -XAt -U postgres -d projetassos -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" = 0
dc run --rm --no-deps -T --entrypoint sh back -ceu 'test -z "$(ls -A /app/storage)"'
dc exec -T db pg_restore -U postgres -d projetassos --role=projetassos_app \
  --no-owner --no-privileges --single-transaction --exit-on-error < "$backup/db.dump"
dc run --rm --no-deps -T --entrypoint sh back -ceu \
  'test -z "$(ls -A /app/storage)"; umask 077; exec tar -xzf - --no-same-owner --no-same-permissions -C /app/storage' \
  < "$backup/media.tar.gz"
dc run --rm --no-deps migrate
dc up -d --wait back front
```

Contrôler la santé de l’API, un article avec image et un téléchargement GPX réservé à un compte actif avant de basculer le trafic. Si une étape échoue, garder la destination hors service jusqu’à la reprise complète.

## Références

- [HTTPS automatique de Caddy](https://caddyserver.com/docs/automatic-https)
- [Express derrière un proxy inverse](https://expressjs.com/en/guide/behind-proxies.html)
- [Image PostgreSQL officielle](https://github.com/docker-library/docs/blob/master/postgres/README.md)
- [Prisma Migrate en production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
