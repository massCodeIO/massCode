// Временный сбой сохранения — 503 (файл ещё качается из облака) и сетевые
// ошибки без ответа: правку имеет смысл ретраить или ждать. Окончательные
// отказы (404 удалённой записи, 400) ретраить бессмысленно — они не должны
// ни зацикливать очереди сохранения, ни блокировать навигацию.
export function isRetriableSaveError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === undefined || status === 503
}
