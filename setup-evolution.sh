#!/bin/bash
cd /opt/evolution
docker compose down 2>/dev/null

cat > docker-compose.yml << 'ENDOFFILE'
services:
  evolution:
    image: atendai/evolution-api:latest
    container_name: evolution
    restart: always
    ports:
      - "8080:8080"
    environment:
      - AUTHENTICATION_API_KEY=ff5c45e93d0c3025e03f8ab96d9b4a598117ee181c93828dd66d9d9cc1b82078
      - SERVER_URL=https://evo.launchfly.ai
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://postgres:evo_secret_pass@postgres:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379
      - CACHE_REDIS_PREFIX_KEY=evo
      - CACHE_LOCAL_ENABLED=false
      - LOG_LEVEL=WARN
    volumes:
      - evolution_data:/evolution/instances
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    container_name: evolution_db
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=evo_secret_pass
      - POSTGRES_DB=evolution
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: evolution_redis
    restart: always
    volumes:
      - redis_data:/data

volumes:
  evolution_data:
  postgres_data:
  redis_data:
ENDOFFILE

echo "Starting containers..."
docker compose up -d
echo "Waiting 20s for startup..."
sleep 20
echo "--- Container logs ---"
docker logs evolution --tail 10
echo ""
echo "--- Creating instance ---"
curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: ff5c45e93d0c3025e03f8ab96d9b4a598117ee181c93828dd66d9d9cc1b82078" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"launchfly-main","integration":"WHATSAPP-BAILEYS","qrcode":true}'
echo ""
echo "--- Waiting 10s for QR ---"
sleep 10
echo "--- QR Response ---"
curl -s http://localhost:8080/instance/connect/launchfly-main \
  -H "apikey: ff5c45e93d0c3025e03f8ab96d9b4a598117ee181c93828dd66d9d9cc1b82078" | head -c 200
echo ""
echo "--- Done ---"
