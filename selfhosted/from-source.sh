#!/usr/bin/env bash
# Run the open-source Flagsmith API from source WITHOUT Docker (Linux x86_64, needs git, curl, unzip, xz, uv).
# Checked only on Linux x86_64. Other systems stop at the first step with a clear message.
# Uses an embedded PostgreSQL 16 binary build (zonky.io, Maven Central), unprivileged, local only.
#   selfhosted/from-source.sh prepare   # once: clone, install dependencies, init + migrate the database (~2 min)
#   selfhosted/from-source.sh check     # only verify the machine and the tools, change nothing
#   selfhosted/from-source.sh serve     # run Postgres + Flagsmith API on http://127.0.0.1:8000 (Ctrl+C stops both)
# Then:  FLAGSMITH_API_URL=http://127.0.0.1:8000/api/v1/ node scripts/bootstrap-selfhosted.mjs .env
# This is a local test setup with throwaway secrets, not a production deployment.
set -euo pipefail
HOME_DIR="${FLAGSMITH_LOCAL_DIR:-$PWD/.flagsmith-local}"; PGV="${PG_VERSION:-16.4.0}"
PGROOT="$HOME_DIR/pg/root"; PGDATA="$HOME_DIR/pgdata"; PGPORT=54329
export LD_LIBRARY_PATH="$PGROOT/lib"
envs(){ export DATABASE_URL="postgresql://postgres:password@127.0.0.1:$PGPORT/flagsmith" DJANGO_SECRET_KEY=local-test-secret ENVIRONMENT=production DJANGO_SETTINGS_MODULE=app.settings.production DJANGO_ALLOWED_HOSTS='*' EXPERIMENTATION_ENABLED=true USE_POSTGRES_FOR_ANALYTICS=true WAREHOUSE_CREDENTIALS_SECRET=local-test-secret TASK_RUN_METHOD=SYNCHRONOUSLY FLAGSMITH_DOMAIN=localhost:8000 PATH="$HOME_DIR/.venv/bin:$PATH"; }
pg_up(){ mkdir -p "$HOME_DIR/sock"; "$PGROOT/bin/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $HOME_DIR/sock -c listen_addresses=127.0.0.1" -l "$HOME_DIR/pg.log" -w -t 60 start >/dev/null; }
preflight(){
  local os arch missing=""
  os="$(uname -s)"; arch="$(uname -m)"
  if [ "$os" != "Linux" ] || { [ "$arch" != "x86_64" ] && [ "$arch" != "amd64" ]; }; then
    echo "Unsupported system: $os $arch. This script was only checked on Linux x86_64 and downloads an x86_64 PostgreSQL build." >&2; exit 3
  fi
  for t in git curl unzip xz uv; do command -v "$t" >/dev/null 2>&1 || missing="$missing $t"; done
  if [ -n "$missing" ]; then
    echo "Missing tools:$missing" >&2
    case "$missing" in *uv*) echo "Install uv from https://docs.astral.sh/uv/ (it downloads Python 3.12 itself)." >&2;; esac
    exit 4
  fi
}
case "${1:-}" in
 check) preflight; echo "ok: Linux x86_64 and required tools found";;
 prepare)
  preflight
  mkdir -p "$HOME_DIR"; cd "$HOME_DIR"
  [ -d src ] || git clone -q --depth 1 https://github.com/Flagsmith/flagsmith.git src
  [ -d .venv ] || uv venv --python 3.12 .venv
  ( cd src/api && sed -i '/^required-version/d;/^exclude-newer/d' pyproject.toml && VIRTUAL_ENV="$HOME_DIR/.venv" uv pip install -r pyproject.toml )
  if [ ! -d pg/root/bin ]; then mkdir -p pg/root; curl -sfo pg/pg.jar "https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64/$PGV/embedded-postgres-binaries-linux-amd64-$PGV.jar"; (cd pg && unzip -qo pg.jar && tar -xJf postgres-linux-x86_64.txz -C root); fi
  if [ ! -d "$PGDATA/base" ]; then echo password > "$HOME_DIR/pwfile"; "$PGROOT/bin/initdb" -D "$PGDATA" -U postgres --pwfile="$HOME_DIR/pwfile" -A md5 >/dev/null; fi
  pg_up; trap '"$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null' EXIT
  "$HOME_DIR/.venv/bin/python" - "$PGPORT" <<'PY'
import sys, psycopg2
c = psycopg2.connect(host="127.0.0.1", port=int(sys.argv[1]), user="postgres", password="password", dbname="postgres")
c.autocommit = True
cur = c.cursor()
cur.execute("select 1 from pg_database where datname='flagsmith'")
if not cur.fetchone():
    cur.execute("create database flagsmith")
PY
  envs; cd src/api && python manage.py migrate --noinput | tail -2; echo "prepared"
  ;;
 serve)
  preflight; [ -d "$HOME_DIR/src/api" ] || { echo "Run 'selfhosted/from-source.sh prepare' first." >&2; exit 6; }
  cd "$HOME_DIR"; envs; pg_up; trap '"$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null' EXIT
  cd src/api; echo "Flagsmith API on http://127.0.0.1:8000 (liveness: /health/liveness/)"; python manage.py runserver 127.0.0.1:8000 --noreload
  ;;
 *) echo "usage: $0 check|prepare|serve"; exit 2;;
esac
