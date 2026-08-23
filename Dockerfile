# ── Build-Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Corepack darf pnpm ohne Rückfrage herunterladen (nicht-interaktiver Build)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# ── Welche Hälfte wird gebaut? ───────────────────────────────────────────────
#
# Website und Büro entstehen aus demselben Quelltext, aber als zwei Abbilder.
# Der Grund ist nicht Speicherplatz, sondern das Ausrollen: Ändert sich nur das
# Büro, wird auch nur dessen Abbild neu gebaut — der Shop-Container hat beim
# Ausrollen dann nichts zu tun und läuft ohne Unterbrechung weiter. Bei einem
# gemeinsamen Abbild startete jede Büro-Änderung den Shop mit neu.
#
# Getrennt wird vor dem Bauen, indem die Seiten der anderen Hälfte
# verschwinden. Das geht, weil die beiden Routenbäume einander nicht anfassen.
# Geteilt wird nur der Unterbau darunter — Datenmodell, Payload, `src/lib` —,
# und der liegt in beiden.
#
# `src/components/office` bleibt im Website-Abbild absichtlich liegen: Der
# Passkey-Knopf im Admin-Panel benutzt die Anmeldung des Büros. Ohne Routen
# darauf ist das totes Gewicht von wenigen Kilobyte — mit gelöschtem Ordner
# scheitert der Bau.
#
# `alles` (Standard) baut wie bisher beides in ein Abbild; so laufen
# Entwicklung und Prüfung weiter mit einem einzigen Start.
ARG ROLLE=alles
RUN set -e; \
    case "$ROLLE" in \
      web) \
        echo "Baue nur Website, Shop und Admin-Panel."; \
        rm -rf "src/app/(office)" ;; \
      buero) \
        echo "Baue nur das Büro."; \
        rm -rf "src/app/(frontend)" "src/app/(payload)" \
               src/app/robots.ts src/app/sitemap.ts ;; \
      *) echo "Baue beides in ein Abbild." ;; \
    esac

# Dummy-Werte nur für den Build — zur Laufzeit kommen die echten aus dem Stack.
#
# Bewusst am Befehl statt als ENV: Payload liest Schlüssel und Datenbankadresse
# schon beim Übersetzen, gebraucht werden sie aber nur für diesen einen Schritt.
# Als ENV blieben sie in der Beschreibung des Zwischenabbilds stehen — und ein
# Eintrag namens PAYLOAD_SECRET wird von der Prüfung des Runners als Geheimnis
# gemeldet, auch wenn nur ein Platzhalter darin steht. Eine Warnung, die man
# jedes Mal wegerklären muss, ist so gut wie keine.
RUN export PAYLOAD_SECRET=build-time-secret \
    DATABASE_URI=postgres://build:build@localhost:5432/build \
    NODE_ENV=production; \
    pnpm build && pnpm prune --prod

# ── Runtime-Stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Wird vom Workflow mitgegeben; /api/healthz meldet ihn zurück, damit nach
# einem Ausrollen erkennbar ist, welcher Stand wirklich läuft
ARG GIT_SHA=unbekannt
ENV APP_VERSION=$GIT_SHA

# Dieselbe Rolle wie beim Bauen — der Prozess soll nicht nach Arbeit suchen,
# die in seinem Abbild gar nicht liegt. Im Stack lässt sie sich überstimmen.
ARG ROLLE=alles
ENV ROLLE=$ROLLE

# Für die Sicherung: pg_dump zieht die Datenbank, smbclient schiebt das fertige
# Archiv auf die NAS. Beides läuft aus der App heraus, damit die Sicherung im
# Büro sichtbar ist statt in einem stillen Nebencontainer.
RUN apk add --no-cache postgresql17-client samba-client tar

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=node:node /app/server.mjs ./server.mjs
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=node:node /app/CHANGELOG.md ./CHANGELOG.md

# Persistente Verzeichnisse (als Volumes mounten!)
RUN mkdir -p /app/media /app/backups \
    && chown node:node /app/media /app/backups \
    && chmod +x /app/docker-entrypoint.sh

USER node
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
