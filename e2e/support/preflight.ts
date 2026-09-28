import net from 'node:net'
import { TEST_MILVUS_URI, TEST_MINIO_ENDPOINT, TEST_POSTGRES_DSN } from './env'

/**
 * 이 파일의 책임: scenario/env-prod의 전제(SSH 터널 3포트)를 실행 전에 TCP로
 * 실측한다. 터널이 없으면 webServer 30초 타임아웃 5회를 기다리는 대신 3초 안에
 * "터널을 열라"고 원인을 말한다. E2E_SMOKE_ONLY=1(smoke 전용 실행)은 건너뛴다.
 */
function probe(host: string, port: number, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = net.connect({ host, port, timeout: 3000 })
    const fail = () => {
      s.destroy()
      reject(new Error(
        `[e2e preflight] ${label}(${host}:${port}) 연결 실패 — 개발 PC라면 C-1의 OpenSSH ` +
        `터널을 열고 TEST_PG_PORT=15432를 지정했는가, 노드 내부라면 로컬 서비스가 떠 있는가? ` +
        `(smoke만 돌리려면 E2E_SMOKE_ONLY=1)`,
      ))
    }
    s.once('connect', () => { s.destroy(); resolve() })
    s.once('timeout', fail)
    s.once('error', fail)
  })
}

export default async function preflight(): Promise<void> {
  if (process.env.E2E_SMOKE_ONLY === '1') return
  const pg = new URL(TEST_POSTGRES_DSN.replace(/^postgresql:/, 'http:'))
  const milvus = new URL(TEST_MILVUS_URI)
  const [minioHost, minioPort] = TEST_MINIO_ENDPOINT.split(':')
  await Promise.all([
    probe(pg.hostname, Number(pg.port || 5432), 'PostgreSQL 터널'),
    probe(milvus.hostname, Number(milvus.port || 19530), 'Milvus 터널'),
    probe(minioHost, Number(minioPort || 9000), 'MinIO 터널'),
  ])
}
