#!/usr/bin/env bash
# Society Event & Attendance Management System - Startup Script

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting TechXtract Attendance Management System"
echo "=========================================================="

# 1. Check Python Virtualenv
if [ -d "venv" ]; then
    PYTHON_EXEC="./venv/bin/python"
    UVICORN_EXEC="./venv/bin/uvicorn"
else
    PYTHON_EXEC="python3"
    UVICORN_EXEC="uvicorn"
fi

# 2. Cleanup any old processes on ports 8000 and 3000
echo "[1/3] Ensuring ports 8000 & 3000 are clear..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# 3. Start Backend
echo "[2/3] Starting FastAPI backend on http://127.0.0.1:8000..."
PYTHONPATH=. $UVICORN_EXEC backend.app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# 4. Start Frontend
echo "[3/3] Starting Next.js frontend on http://localhost:3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Cleanup handler on exit (Ctrl+C)
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill -9 $BACKEND_PID 2>/dev/null || true
    kill -9 $FRONTEND_PID 2>/dev/null || true
    echo "Done. Goodbye!"
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "=========================================================="
echo " System is LIVE:"
echo " -> Frontend:     http://localhost:3000"
echo " -> Backend API:  http://127.0.0.1:8000/docs"
echo " Default Logins:"
echo " -> Super Admin:  admin@techxtract.edu / Admin@12345"
echo " -> Coordinator:  coordinator@techxtract.edu / Coord@12345"
echo "=========================================================="
echo "Press Ctrl+C to stop both servers."

# Open browser on macOS
if command -v open >/dev/null 2>&1; then
    sleep 2
    open http://localhost:3000
fi

# Keep script running
wait
