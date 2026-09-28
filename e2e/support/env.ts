import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 이 파일의 책임: e2e 백엔드 접속값 조립(R6B-12·R6B-15).
 *
 * 축이 둘이다 — 섞지 않는다:
 *  · **자격증명·키**(DB 계정/비번, MinIO 키, GOOGLE_API_KEY)는 레포에 없고 사람마다
 *    `workspace/app/.env`에만 있다(C-2) → `.env`에서 파생한다.
 *  · **접속 좌표**(호스트·포트)는 실행 위치마다 다르다(C-6/R6B-15 — 노드 내부·
 *    온프레미스·개발 PC 터널) → env 변수 + **로컬 직결 기본값**으로만 정한다.
 *    기본값은 노드 내부 실행(PG 127.0.0.1:5432 · Milvus localhost:19530 ·
 *    MinIO localhost:9000)이고, 개발 PC(SSH 터널)는 TEST_PG_PORT=15432만 지정한다.
 *
 * 우선순위: 전체 오버라이드(E2E_POSTGRES_DSN 등) > 좌표 env(TEST_PG_HOST/PORT 등)
 * + .env 파생 자격증명 > 로컬 직결 기본값. DB 이름은 항상 museum_test로 강제해
 * 운영 DB(archive)를 겨누지 못하게 한다(값 판정은 백엔드 e2e_guards가 한 번 더 한다).
 */
// package.json의 "type": "module" 아래 Playwright는 이 파일을 네이티브 ESM으로 로드해
// __dirname이 없다(2026-07-29 실측 — `playwright test --list`가 config→env.ts import
// 사슬에서 ReferenceError로 죽었다). import.meta.url로 동등하게 유도한다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.resolve(__dirname, '..', '..', '..', '.env') // web/e2e/support → workspace/app/.env

function parseDotEnv(p: string): Record<string, string> {
  if (!fs.existsSync(p)) return {}
  const out: Record<string, string> = {}
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return out
}

const dotenv = parseDotEnv(ENV_PATH)

// ── 접속 좌표(C-6) — env 주도 + 로컬 직결 기본값. 포트 하드코딩 금지. ──
export const TEST_PG_HOST = process.env.TEST_PG_HOST || '127.0.0.1'
export const TEST_PG_PORT = Number(process.env.TEST_PG_PORT || 5432)

/** `.env` POSTGRES_DSN에서 자격증명(user:pw)만 뽑는다 — 호스트·포트·DB는 버린다. */
function credentialsFromDsn(dsn: string | undefined): string {
  if (!dsn) return ''
  const m = dsn.match(/^postgresql:\/\/([^@/]+)@/)
  return m ? m[1] : ''
}

const pgCredentials = credentialsFromDsn(dotenv.POSTGRES_DSN)

export const TEST_POSTGRES_DSN =
  process.env.E2E_POSTGRES_DSN
  ?? (pgCredentials
    ? `postgresql://${pgCredentials}@${TEST_PG_HOST}:${TEST_PG_PORT}/museum_test`
    : '')

export const TEST_MILVUS_URI = process.env.E2E_MILVUS_URI || 'http://localhost:19530'

export const TEST_MILVUS_COLLECTION = 'artifacts_dual_v1_test'

export const TEST_MINIO_ENDPOINT = process.env.E2E_MINIO_ENDPOINT || 'localhost:9000'

export const TEST_MINIO_ACCESS_KEY =
  process.env.E2E_MINIO_ACCESS_KEY ?? dotenv.MINIO_ACCESS_KEY ?? ''
export const TEST_MINIO_SECRET_KEY =
  process.env.E2E_MINIO_SECRET_KEY ?? dotenv.MINIO_SECRET_KEY ?? ''

export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? dotenv.GOOGLE_API_KEY ?? ''
