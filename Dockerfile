# 노드 A 프런트엔드 이미지(web). Vite로 SPA를 빌드해 nginx 정적 서빙.
# 멀티스테이지: node(빌드) → nginx(런타임). 런타임 이미지에는 node·소스가 남지 않는다.

# ── 1) 빌드 스테이지 ──
FROM node:22-alpine AS build
WORKDIR /app

# 잠금 기반 재현 설치(npm ci). package*.json 먼저 복사해 의존성 레이어 캐시 재사용.
COPY package.json package-lock.json* ./
RUN npm ci

# 소스 복사 후 빌드(vite build → dist/). 프론트가 부를 API 베이스는 빌드 시 주입한다 —
# 게이트웨이 nginx가 /api 를 api:8000 으로 프록시하므로 기본값 /api(동일 오리진, CORS 불필요).
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# round06f — Maze UT 스니펫 키(spec §11.4). compose build args → 이 ARG → ENV → npm run build
# 순서라야 vite 의 loadEnv 가 process.env 에서 읽는다. ARG 만 두면 RUN 레이어 환경에 값이
# 없고, RUN 뒤에 두면 순서상 늦다 — 셋 다 "빌드 성공 + 화면 정상"이라 눈으로 구분되지 않아
# tests/test_docker_maze_key.py 가 순서까지 잠근다. 기본값은 빈 값(로컬·미설정 = no-op).
ARG VITE_MAZE_API_KEY=
ENV VITE_MAZE_API_KEY=$VITE_MAZE_API_KEY
RUN npm run build

# ── 2) 런타임 스테이지 ──
# 비루트 런타임: nginx-unprivileged 는 비루트(uid 101)로 실행되며 기본 listen 포트가 8080 이다
#   (1024 미만 특권 포트를 못 여는 비루트 제약 때문). nginx.conf·compose expose·게이트웨이
#   upstream(proxy_pass http://web:8080) 이 모두 8080 으로 정합되어 있어야 한다.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# SPA 정적 산출물.
COPY --from=build /app/dist /usr/share/nginx/html
# 라우팅·/api 프록시 설정(컨테이너 내부에서 api:8000 으로 프록시 — compose 서비스명).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 비루트 기본 포트와 일치(아래 nginx.conf 의 listen 8080 과 정합).
EXPOSE 8080
