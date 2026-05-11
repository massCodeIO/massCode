import type {
  CaptureTarget,
  ExtensionSettings,
  PageCapturePayload,
} from './types'
import {
  buildCaptureRequest,
  getCaptureNameSuggestion,
  getSettings,
  isCaptureTarget,
  postCapture,
  saveSettings,
} from './api'
import { getPageCaptureFromPage } from './pageCapture'
import './styles.css'

const apiPortInput = document.querySelector<HTMLInputElement>('#apiPort')
const apiTokenInput = document.querySelector<HTMLInputElement>('#apiToken')
const captureNameInput
  = document.querySelector<HTMLInputElement>('#captureName')
const previewInput = document.querySelector<HTMLTextAreaElement>('#preview')
const previewLabel = document.querySelector<HTMLSpanElement>('#previewLabel')
const saveSettingsButton
  = document.querySelector<HTMLButtonElement>('#saveSettings')
const captureButton = document.querySelector<HTMLButtonElement>('#capture')
const captureLabel = document.querySelector<HTMLSpanElement>('#captureLabel')
const settingsPanel = document.querySelector<HTMLElement>('#settingsPanel')
const sourceMark = document.querySelector<HTMLDivElement>('.source-mark')
const sourceTitle = document.querySelector<HTMLSpanElement>('#sourceTitle')
const sourcePath = document.querySelector<HTMLSpanElement>('#sourcePath')
const statusText = document.querySelector<HTMLParagraphElement>('#status')
const toggleSettingsButton
  = document.querySelector<HTMLButtonElement>('#toggleSettings')
const targetButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-target]'),
)

let settings: ExtensionSettings
let activeTarget: CaptureTarget = 'notes'
let currentPayload: PageCapturePayload | null = null
let isCaptureNameEdited = false

void init()

async function init(): Promise<void> {
  settings = await getSettings()
  activeTarget = settings.defaultTarget

  if (apiPortInput) {
    apiPortInput.value = String(settings.apiPort)
  }

  if (apiTokenInput) {
    apiTokenInput.value = settings.apiToken
  }

  bindEvents()
  updateTargetButtons()
  updateSettingsPanel(!settings.apiToken.trim())

  try {
    currentPayload = await getActiveTabCapture()
    updateCaptureName(true)
    updateSourceRow()
    updatePreview()
  }
  catch (error) {
    setStatus(getErrorMessage(error), true)
  }
}

function bindEvents(): void {
  targetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.target
      if (!isCaptureTarget(target)) {
        return
      }

      activeTarget = target
      settings.defaultTarget = target
      updateTargetButtons()
      updateCaptureName()
      updatePreview()
    })
  })

  captureNameInput?.addEventListener('input', () => {
    isCaptureNameEdited = true
  })

  toggleSettingsButton?.addEventListener('click', () => {
    updateSettingsPanel(settingsPanel?.hidden ?? true)
  })

  saveSettingsButton?.addEventListener('click', () => {
    void persistSettings()
  })

  captureButton?.addEventListener('click', () => {
    void captureCurrentPayload()
  })

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void captureCurrentPayload()
      return
    }

    if (event.key === 'Escape') {
      window.close()
    }
  })
}

async function persistSettings(): Promise<void> {
  settings = readSettingsFromForm()
  await saveSettings(settings)
  setStatus('Settings saved.')
}

async function captureCurrentPayload(): Promise<void> {
  if (!currentPayload) {
    setStatus('No active page to capture.', true)
    return
  }

  settings = readSettingsFromForm()
  await saveSettings(settings)

  if (!settings.apiToken.trim()) {
    setStatus('Set the massCode API token first.', true)
    return
  }

  try {
    const request = buildCaptureRequest(
      activeTarget,
      currentPayload,
      captureNameInput?.value,
    )
    const result = await postCapture(settings, request)
    setStatus(`Saved ${result.target} item #${result.id}.`)
  }
  catch (error) {
    setStatus(getErrorMessage(error), true)
  }
}

async function getActiveTabCapture(): Promise<PageCapturePayload> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab.id) {
    throw new Error('No active tab found.')
  }

  const [response] = await chrome.scripting.executeScript<PageCapturePayload>({
    func: getPageCaptureFromPage,
    target: { tabId: tab.id },
  })

  if (!response.result) {
    throw new Error('Could not read the active page.')
  }

  return {
    ...response.result,
    faviconUrl: tab.favIconUrl,
  }
}

function readSettingsFromForm(): ExtensionSettings {
  return {
    apiPort: Number(apiPortInput?.value) || settings.apiPort,
    apiToken: apiTokenInput?.value ?? settings.apiToken,
    defaultTarget: activeTarget,
  }
}

function updateTargetButtons(): void {
  targetButtons.forEach((button) => {
    button.dataset.active
      = button.dataset.target === activeTarget ? 'true' : 'false'
  })

  if (captureLabel) {
    captureLabel.textContent = getCaptureButtonLabel(activeTarget)
  }
}

function updateCaptureName(force = false): void {
  if (!captureNameInput || !currentPayload) {
    return
  }

  if (isCaptureNameEdited && !force) {
    return
  }

  captureNameInput.value = getCaptureNameSuggestion(
    activeTarget,
    currentPayload,
  )
  isCaptureNameEdited = false
}

function updatePreview(): void {
  if (!previewInput || !currentPayload) {
    return
  }

  if (activeTarget === 'http') {
    previewInput.value = currentPayload.url
    updatePreviewLabel()
    return
  }

  if (activeTarget === 'notes') {
    previewInput.value
      = currentPayload.selectedMarkdown
        || currentPayload.selectedText
        || currentPayload.pageMarkdown
        || currentPayload.pageText
        || currentPayload.pageTitle
    updatePreviewLabel()
    return
  }

  previewInput.value = currentPayload.selectedText || currentPayload.pageTitle
  updatePreviewLabel()
}

function updateSettingsPanel(isOpen: boolean): void {
  if (!settingsPanel || !toggleSettingsButton) {
    return
  }

  settingsPanel.hidden = !isOpen
  toggleSettingsButton.dataset.active = isOpen ? 'true' : 'false'
}

function updateSourceRow(): void {
  if (!currentPayload) {
    return
  }

  const source = getSourceParts(currentPayload)

  if (sourceTitle) {
    sourceTitle.textContent = source.title
  }

  if (sourcePath) {
    sourcePath.textContent = source.path
  }

  updateSourceIcon(currentPayload.faviconUrl)
}

function updatePreviewLabel(): void {
  if (!previewLabel || !previewInput) {
    return
  }

  const lines = previewInput.value ? previewInput.value.split('\n').length : 0
  const format = getPreviewFormat()

  previewLabel.textContent = `Preview · ${format} · ${lines} ${lines === 1 ? 'line' : 'lines'}`
}

function getPreviewFormat(): string {
  if (activeTarget === 'http') {
    return 'url'
  }

  if (
    activeTarget === 'notes'
    && (currentPayload?.selectedMarkdown || currentPayload?.pageMarkdown)
  ) {
    return 'markdown'
  }

  return activeTarget === 'code' ? 'plain text' : 'text'
}

function getSourceParts(payload: PageCapturePayload): {
  path: string
  title: string
} {
  try {
    const url = new URL(payload.sourceUrl)

    return {
      path: payload.contextLabel ?? (url.pathname || '/'),
      title: url.hostname.replace(/^www\./, ''),
    }
  }
  catch {
    return {
      path: payload.contextLabel ?? payload.sourceUrl,
      title: payload.sourceTitle || 'Current page',
    }
  }
}

function updateSourceIcon(faviconUrl?: string): void {
  if (!sourceMark) {
    return
  }

  sourceMark.textContent = ''

  if (!faviconUrl) {
    sourceMark.textContent = 'M'
    sourceMark.style.backgroundImage = ''
    return
  }

  sourceMark.style.backgroundImage = `url("${faviconUrl}")`
}

function getCaptureButtonLabel(target: CaptureTarget): string {
  return target === 'code'
    ? 'Save snippet'
    : target === 'notes'
      ? 'Save note'
      : 'Save request'
}

function setStatus(message: string, isError = false): void {
  if (!statusText) {
    return
  }

  statusText.textContent = message
  statusText.dataset.error = isError ? 'true' : 'false'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
