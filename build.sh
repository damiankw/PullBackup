#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  echo "Usage: ./build.sh [local|docker]"
  echo ""
  echo "  local   Build React and copy into backend/frontend_build (for local uvicorn dev)"
  echo "  docker  Build the unified Docker image"
  echo ""
  echo "Defaults to 'local' if no argument is given."
}

MODE="${1:-local}"

case "$MODE" in
  local)
    echo "==> Building React frontend..."
    cd frontend
    npm run build
    cd "$SCRIPT_DIR"

    echo "==> Copying build into backend/frontend_build..."
    rm -rf backend/frontend_build
    cp -r frontend/build backend/frontend_build

    echo ""
    echo "Done. Start the app with:"
    echo "  ./run.sh"
    echo ""
    echo "Or manually:"
    echo "  cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    ;;

  docker)
    echo "==> Building unified Docker image..."
    docker build -t pullbackup:latest .

    echo ""
    echo "Done. Run with:"
    echo "  docker compose up"
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
