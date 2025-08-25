FROM node:20

ARG ENV
ARG APP
ARG PORT

ENV NODE_ENV=$ENV
ENV APP_NAME=$APP
ENV PORT=$PORT

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build:$APP_NAME

EXPOSE $PORT

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]

