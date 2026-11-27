#!/usr/bin/env bash
# Run the open-source Flagsmith API from source WITHOUT Docker (Linux x86_64, needs git, curl, unzip, xz, uv).
# Uses an embedded PostgreSQL 16 binary build (zonky.io, Maven Central), unprivileged, local only.
#   selfhosted/from-source.sh prepare   # once: clone, install dependencies, init + migrate the database (~2 min)
#   selfhosted/from-source.sh serve     # run Postgres + Flagsmith API on http://127.0.0.1:8000 (Ctrl+C stops both)
# Then:  FLAGSMITH_API_URL=http://127.0.0.1:8000/api/v1/ node scripts/bootstrap-selfhosted.mjs .env
# This is a local test setup with throwaway secrets, not a production deployment.
set -euo pipefail
HOME_DIR="${FLAGSMITH_LOCAL_DIR:-$PWD/.flagsmith-local}"; PGV="${PG_VERSION:-16.4.0}"
PGROOT="$HOME_DIR/pg/root"; PGDATA="$HOME_DIR/pgdata"; PGPORT=54329
export LD_LIBRARY_PATH="$PGROOT/lib"
envs(){ export DATABASE_URL="postgresql://postgres:password@127.0.0.1:$PGPORT/flagsmith" DJANGO_SECRET_KEY=local-test-secret ENVIRONMENT=production DJANGO_SETTINGS_MODULE=app.settings.production DJANGO_ALLOWED_HOSTS='*' EXPERIMENTATION_ENABLED=true USE_POSTGRES_FOR_ANALYTICS=true WAREHOUSE_CREDENTIALS_SECRET=local-test-secret TASK_RUN_METHOD=SYNCHRONOUSLY FLAGSMITH_DOMAIN=localhost:8000 PATH="$HOME_DIR/.venv/bin:$PATH"; }
pg_up(){ mkdir -p "$HOME_DIR/sock"; "$PGROOT/bin/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $HOME_DIR/sock -c listen_addresses=127.0.0.1" -l "$HOME_DIR/pg.log" -w -t 60 start >/dev/null; }
case "${1:-}" in
 prepare)
  mkdir -p "$HOME_DIR"; cd "$HOME_DIR"
  [ -d src ] || git clone -q --depth 1 https://github.com/Flagsmith/flagsmith.git src
  [ -d .venv ] || uv venv --python 3.12 .venv
  ( cd src/api && sed -i '/^required-version/d;/^exclude-newer/d' pyproject.toml && VIRTUAL_ENV="$HOME_DIR/.venv" uv pip install -r pyproject.toml )
  if [ ! -d pg/root/bin ]; then mkdir -p pg/root; curl -sfo pg/pg.jar "https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64/$PGV/embedded-postgres-binaries-linux-amd64-$PGV.jar"; (cd pg && unzip -qo pg.jar && tar -xJf postgres-linux-x86_64.txz -C root); fi
  if [ ! -d "$PGDATA/base" ]; then echo password > "$HOME_DIR/pwfile"; "$PGROOT/bin/initdb" -D "$PGDATA" -U postgres --pwfile="$HOME_DIR/pwfile" -A md5 >/dev/null; fi
  pg_up; trap '"$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null' EXIT
  PGPASSWORD=password psql -h 127.0.0.1 -p $PGPORT -U postgres -tc "select 1 from pg_database where datname='flagsmith'" | grep -q 1 || PGPASSWORD=password psql -h 127.0.0.1 -p $PGPORT -U postgres -c "create database flagsmith" >/dev/null
  envs; cd src/api && python manage.py migrate --noinput | tail -2; echo "prepared"
  ;;
 serve)
  cd "$HOME_DIR"; envs; pg_up; trap '"$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null' EXIT
  cd src/api; echo "Flagsmith API on http://127.0.0.1:8000 (liveness: /health/liveness/)"; python manage.py runserver 127.0.0.1:8000 --noreload
  ;;
 *) echo "usage: $0 prepare|serve"; exit 2;;
esac
