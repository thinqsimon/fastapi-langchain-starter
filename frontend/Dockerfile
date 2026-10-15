# 프론트엔드 컨테이너(개발용). 운영 배포는 Vercel을 쓴다.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
