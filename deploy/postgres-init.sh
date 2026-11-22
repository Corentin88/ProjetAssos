#!/bin/sh
(
  set -eu
  case "$APP_DB_PASSWORD" in
    ''|*[!0-9a-fA-F]*) printf '%s\n' 'APP_DB_PASSWORD doit être hexadécimal.' >&2; exit 1 ;;
  esac
  if [ "${#APP_DB_PASSWORD}" -lt 32 ]; then
    printf '%s\n' 'APP_DB_PASSWORD doit contenir au moins 32 caractères.' >&2
    exit 1
  fi

  psql -X --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password APP_DB_PASSWORD
CREATE ROLE projetassos_app LOGIN PASSWORD :'app_password';
ALTER DATABASE projetassos OWNER TO projetassos_app;
REVOKE CONNECT, TEMP ON DATABASE projetassos FROM PUBLIC;
SQL
)
