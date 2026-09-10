# ---- Build de l'API .NET ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api-build
WORKDIR /src
COPY EpubLibrary/EpubLibrary.csproj EpubLibrary/
RUN dotnet restore EpubLibrary/EpubLibrary.csproj
COPY EpubLibrary/ EpubLibrary/
COPY assets/ assets/
RUN dotnet publish EpubLibrary/EpubLibrary.csproj \
    --configuration Release \
    --output /out/api \
    --no-restore

# ---- Build de l'interface Next.js ----
FROM node:20-bookworm-slim AS web-build
WORKDIR /src/epub-reader-ui
RUN corepack enable
COPY epub-reader-ui/package.json epub-reader-ui/pnpm-lock.yaml epub-reader-ui/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY epub-reader-ui/ ./
# Les appels du navigateur restent relatifs et passent par Caddy.
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_TTS_API_URL=""
RUN pnpm build

# ---- Environnement Python de Kokoro (CPU) ----
FROM python:3.12-slim-bookworm AS kokoro-build
ENV VIRTUAL_ENV=/opt/kokoro-venv
RUN python -m venv "$VIRTUAL_ENV"
COPY assets/tts/kokoro/requirements.txt /tmp/kokoro-requirements.txt
RUN "$VIRTUAL_ENV/bin/pip" install --no-cache-dir --upgrade pip \
    && "$VIRTUAL_ENV/bin/pip" install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && "$VIRTUAL_ENV/bin/pip" install --no-cache-dir -r /tmp/kokoro-requirements.txt

# Piper embarque ONNX Runtime 1.14, qui charge encore OpenSSL 1.1.
FROM node:20-bullseye-slim AS legacy-openssl

# ---- Image finale unique : Caddy + API + interface ----
FROM node:20-bookworm-slim AS runtime
COPY --from=mcr.microsoft.com/dotnet/aspnet:8.0 /usr/share/dotnet /usr/share/dotnet
COPY --from=legacy-openssl /usr/lib/x86_64-linux-gnu/libssl.so.1.1 /usr/lib/x86_64-linux-gnu/libssl.so.1.1
COPY --from=legacy-openssl /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1 /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1
COPY --from=kokoro-build /usr/local /usr/local
COPY --from=kokoro-build /opt/kokoro-venv /opt/kokoro-venv
COPY --from=caddy:2-alpine /usr/bin/caddy /usr/bin/caddy
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
    ASPNETCORE_URLS=http://127.0.0.1:5055 \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=127.0.0.1 \
    MyLibrary__Path=/data/library \
    Tts__Kokoro__Directory=/app/kokoro \
    Tts__Kokoro__Python=/opt/kokoro-venv/bin/python \
    HF_HOME=/data/models/huggingface \
    HF_HUB_DISABLE_XET=1 \
    XDG_CACHE_HOME=/data/models/cache
WORKDIR /app
COPY --from=api-build /out/api ./api
COPY assets/tts/kokoro/server.py ./kokoro/server.py
COPY --from=web-build /src/epub-reader-ui/.next/standalone ./web
COPY --from=web-build /src/epub-reader-ui/.next/static ./web/.next/static
COPY Caddyfile ./Caddyfile
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng libsndfile1 libgomp1 libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet \
    && chmod +x ./docker-entrypoint.sh \
    && mkdir -p /data/library /data/models
VOLUME ["/data/library", "/data/models"]
EXPOSE 3005
ENTRYPOINT ["/app/docker-entrypoint.sh"]
