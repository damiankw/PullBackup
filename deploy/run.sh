#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

usage() {
  echo "Usage: ./deploy/run.sh [local|docker]"
  echo ""
  echo "  local   Start the backend with uvicorn (uses backend/venv)"
  echo "  docker  Start with Docker Compose"
  echo ""
  echo "Defaults to 'local' if no argument is given."
}

MODE="${1:-local}"

case "$MODE" in
  local)
    UVICORN="$ROOT_DIR/backend/venv/bin/uvicorn"
    if [ ! -f "$UVICORN" ]; then
      echo "Error: venv not found at backend/venv. Set one up with:"
      echo "  cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
      exit 1
    fi

    if [ ! -f "$ROOT_DIR/backend/frontend_build/index.html" ]; then
      echo "Warning: frontend_build not found. Run ./deploy/build.sh first to compile the React app."
      echo ""
    fi

    echo "==> Starting PullBackup on http://localhost:8000"
    mkdir -p "$ROOT_DIR/data"
    cd "$ROOT_DIR"
    "$UVICORN" app.main:app --app-dir "$ROOT_DIR/backend" --host 0.0.0.0 --port 8000 --reload --reload-dir "$ROOT_DIR/backend"
    ;;

  docker)
    echo "==> Starting PullBackup with Docker Compose..."
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" up
    ;;

  -h|--help|help)
    usage
    ;;

  *)
    echo "Unknown mode: $MODE"
    usage
    exit 1
    ;;
esac
