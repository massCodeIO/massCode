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
const saveSettingsButton
  = document.querySelector<HTMLButtonElement>('#saveSettings')
const captureButton = document.querySelector<HTMLButtonElement>('#capture')
const statusText = document.querySelector<HTMLParagraphElement>('#status')
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

  try {
    currentPayload = await getActiveTabCapture()
    updateCaptureName(true)
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

  saveSettingsButton?.addEventListener('click', () => {
    void persistSettings()
  })

  captureButton?.addEventListener('click', () => {
    void captureCurrentPayload()
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

  return response.result
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
    return
  }

  previewInput.value = currentPayload.selectedText || currentPayload.pageTitle
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
