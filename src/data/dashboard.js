export const dashboard = {
  todayQueries: 9142,
  indexed: 48,
  embeddingRate: 92,
  searchRequests: 8,
  hourly: Array.from({ length: 12 }).map((_, i) => ({ hour: `${i * 2}시`, value: Math.round(40 + 60 * Math.sin(i)) + 50 })),
  processing: { ocr: 70.8, translate: 92.2, learning: 65.5 },
}
