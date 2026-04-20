#-------------------- development -----------------------
FROM node:25-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

EXPOSE 5000

CMD ["npm", "run", "start:dev"]


#-------------------- build -----------------------
FROM node:25-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN npm ci

COPY . . 

RUN npm run build
RUN npm prune --production


#-------------------- production -----------------------
FROM node:25-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/main.js"]