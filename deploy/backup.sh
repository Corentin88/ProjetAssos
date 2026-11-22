#!/usr/bin/env bash
set -euo pipefail
umask 077

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
env_file=${PROD_ENV_FILE:-"$root/.env.production"}
: "${BACKUP_DIR:?Définissez BACKUP_DIR avec un répertoire privé hors dépôt}"
case "$BACKUP_DIR" in
  /*) ;;
  *) printf '%s\n' 'BACKUP_DIR doit être un chemin absolu.' >&2; exit 1 ;;
esac
destination=$(cd -- "$BACKUP_DIR" && pwd -P)
case "$destination/" in
  "$root/"*) printf '%s\n' 'Le répertoire de sauvegarde doit être hors du dépôt.' >&2; exit 1 ;;
esac
if [[ $(stat -c %a -- "$destination") != 700 || ! -O "$destination" ]]; then
  printf '%s\n' 'Le répertoire doit appartenir à votre compte et être en mode 0700.' >&2
  exit 1
fi
if [[ ! -r "$env_file" ]]; then
  printf 'Fichier de variables illisible : %s\n' "$env_file" >&2
  exit 1
fi
exec 9>"$destination/.backup.lock"
flock -n 9 || { printf '%s\n' 'Une sauvegarde est déjà en cours.' >&2; exit 1; }

dc() {
  docker compose -p projetassos-production --env-file "$env_file" -f "$root/compose.production.yaml" "$@"
}

pending=$(mktemp -d "$destination/.projetassos-XXXXXXXX")
restart_api=0
cleanup() {
  status=$?
  trap - EXIT
  if (( restart_api )) && ! dc start back; then
    printf '%s\n' 'Redémarrage de l’API en échec.' >&2
    status=1
  fi
  if [[ -n $pending ]]; then
    rm -f -- "$pending/db.dump" "$pending/media.tar.gz" "$pending/SHA256SUMS"
    rmdir -- "$pending"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# L'API est l'unique écrivain des médias et peut publier des articles en arrière-plan.
if [[ -n $(dc ps --status running -q back) ]]; then
  restart_api=1
  dc stop --timeout 30 back
fi

dc exec -T db pg_dump -U postgres -d projetassos --format=custom --no-owner --no-privileges >"$pending/db.dump"
dc run --rm --no-deps -T --entrypoint tar back -czf - -C /app/storage . >"$pending/media.tar.gz"
dc exec -T db pg_restore --list <"$pending/db.dump" >/dev/null
tar -tzf "$pending/media.tar.gz" >/dev/null
(cd -- "$pending" && sha256sum db.dump media.tar.gz >SHA256SUMS)

stamp=$(date -u +%Y%m%dT%H%M%SZ)
result="$destination/projetassos-${stamp}-${pending##*-}"
mv -T -- "$pending" "$result"
pending=''

if (( restart_api )); then
  dc start back
  restart_api=0
fi
printf 'Sauvegarde vérifiée : %s\n' "$result"
