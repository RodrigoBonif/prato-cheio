# Imagem da aplicação. Usada pelo CD para publicar uma versão executável
# do Prato Cheio a cada merge na main.
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3000
# banco SQLite fora do código, num diretório que pode virar volume
ENV DATABASE_FILE=/dados/dados.sqlite

WORKDIR /app

# copia só os manifests primeiro: assim o cache do npm ci só quebra
# quando as dependências mudam, não a cada alteração de código
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

# roda como usuário sem privilégios (o usuário `node` já existe na imagem)
RUN mkdir -p /dados && chown -R node:node /dados /app
USER node

EXPOSE 3000

# o próprio server.js roda a migração antes de escutar a porta
CMD ["node", "--no-warnings=ExperimentalWarning", "src/server.js"]
