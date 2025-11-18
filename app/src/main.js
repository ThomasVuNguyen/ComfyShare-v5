import './style.css'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import SimpleImage from '@editorjs/simple-image'
import LinkTool from '@editorjs/link'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="workspace">
    <div id="panel-overlay" class="panel-overlay" aria-hidden="true"></div>
    <header class="workspace-bar">
      <div class="workspace-meta">
        <p class="workspace-label">Demo doc</p>
        <h1>Editor.js canvas</h1>
        <p>Edge-to-edge writing surface powered by the local Editor.js build.</p>
      </div>
      <div class="workspace-controls">
        <div class="quick-inline">
          <button id="add-heading" class="chip" type="button">Heading</button>
          <button id="add-image" class="chip" type="button">Image</button>
          <button id="add-link" class="chip" type="button">Link</button>
        </div>
        <div class="bar-actions">
          <button id="data-toggle" type="button">JSON</button>
          <button id="save-button" type="button">Save</button>
          <button id="theme-toggle" data-variant="ghost" type="button">
            Toggle theme
          </button>
        </div>
      </div>
    </header>
    <section class="workspace-body">
      <div class="canvas-area">
        <div id="editorjs" class="editor-full"></div>
      </div>
      <aside id="comment-panel" class="comment-rail">
        <header class="rail-header">
          <div>
            <p class="eyebrow">Comments</p>
            <p class="comment-count"><span id="comment-count">0</span> total</p>
          </div>
        </header>
        <form id="comment-form" class="comment-form">
          <label for="comment-input">Drop a note on the current block</label>
          <textarea
            id="comment-input"
            placeholder="Type your feedback…"
            rows="3"
            required
          ></textarea>
          <button type="submit">Add comment</button>
        </form>
        <ul id="comment-list" class="comment-list" aria-live="polite"></ul>
      </aside>
    </section>
    <div id="snackbar" class="snackbar" role="status" aria-live="polite"></div>
    <button id="unlock-dock" class="dock-button" type="button">
      Unlock editing
    </button>
    <button id="waitlist-dock" class="dock-button dock-secondary" type="button">
      Join waitlist
    </button>
    <div id="unlock-modal" class="dock-modal" aria-hidden="true">
      <form id="unlock-form">
        <h2>Unlock editing</h2>
        <p class="dock-subtitle">
          Enter the shared password to enable editing for this session.
        </p>
        <label class="dock-field">
          <span>Password</span>
          <input id="unlock-input" name="password" type="password" required />
        </label>
        <p id="unlock-error" class="dock-error" role="alert"></p>
        <div class="dock-actions">
          <button type="submit">Unlock</button>
          <button id="unlock-cancel" data-variant="ghost" type="button">
            Cancel
          </button>
        </div>
      </form>
    </div>
    <div id="waitlist-modal" class="dock-modal" aria-hidden="true">
      <form id="waitlist-form">
        <h2>Get notified</h2>
        <p class="dock-subtitle">
          Leave your info and we&apos;ll reach out when the product launches.
        </p>
        <label class="dock-field">
          <span>Name</span>
          <input id="waitlist-name" name="name" type="text" required />
        </label>
        <label class="dock-field">
          <span>Email</span>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            required
          />
        </label>
        <p id="waitlist-error" class="dock-error" role="alert"></p>
        <div class="dock-actions">
          <button type="submit">Join</button>
          <button id="waitlist-cancel" data-variant="ghost" type="button">
            Cancel
          </button>
        </div>
      </form>
    </div>
    <aside id="data-panel" class="side-panel" aria-hidden="true">
      <header class="panel-header">
        <p class="eyebrow">Saved data</p>
        <button class="panel-close" type="button" aria-label="Close data panel">
          ×
        </button>
      </header>
      <pre id="output" class="editor-output" aria-live="polite"></pre>
    </aside>
  </main>
`

const output = document.getElementById('output')
const saveButton = document.getElementById('save-button')
const commentForm = document.getElementById('comment-form')
const commentInput = document.getElementById('comment-input')
const commentList = document.getElementById('comment-list')
const commentCount = document.getElementById('comment-count')
const themeToggleButton = document.getElementById('theme-toggle')
const headingButton = document.getElementById('add-heading')
const imageButton = document.getElementById('add-image')
const linkButton = document.getElementById('add-link')
const dataPanel = document.getElementById('data-panel')
const dataToggle = document.getElementById('data-toggle')
const overlay = document.getElementById('panel-overlay')
const snackbar = document.getElementById('snackbar')
const unlockDock = document.getElementById('unlock-dock')
const unlockModal = document.getElementById('unlock-modal')
const unlockForm = document.getElementById('unlock-form')
const unlockInput = document.getElementById('unlock-input')
const unlockCancel = document.getElementById('unlock-cancel')
const unlockError = document.getElementById('unlock-error')
const waitlistDock = document.getElementById('waitlist-dock')
const waitlistModal = document.getElementById('waitlist-modal')
const waitlistForm = document.getElementById('waitlist-form')
const waitlistName = document.getElementById('waitlist-name')
const waitlistEmail = document.getElementById('waitlist-email')
const waitlistCancel = document.getElementById('waitlist-cancel')
const waitlistError = document.getElementById('waitlist-error')
const panelCloseButtons = document.querySelectorAll('.panel-close')
const gatingButtons = [saveButton, headingButton, imageButton, linkButton]
gatingButtons.forEach((button) => {
  if (button) {
    button.disabled = true
    button.classList.add('is-disabled')
  }
})
const comments = []
const docRef = doc(collection(db, 'documents'), 'demo')
const commentsRef = collection(docRef, 'comments')
const adminsRef = collection(db, 'admin')
const waitlistRef = collection(db, 'waitlist')

const AUTO_SAVE_INTERVAL = 10000
let autoSaveTimer = null
let isUnlocked = false
let isSaving = false
let latestContent = null

const renderComments = () => {
  if (!commentList) {
    return
  }

  if (!comments.length) {
    commentList.innerHTML =
      '<li class="comment-empty">No comments yet. Add the first one!</li>'
  } else {
    commentList.innerHTML = comments
      .map(
        (comment) => `
        <li>
          <p class="comment-meta">
            ${comment.blockIndexLabel} · ${comment.blockType} · ${
              comment.timestamp
            }
          </p>
          ${
            comment.excerpt
              ? `<blockquote>${comment.excerpt}</blockquote>`
              : ''
          }
          <p class="comment-body">${comment.text}</p>
        </li>
      `
      )
      .join('')
  }

  if (commentCount) {
    commentCount.textContent = comments.length
  }
}

const editor = new EditorJS({
  holder: 'editorjs',
  placeholder: 'Start writing your story...',
  autofocus: true,
  readOnly: true,
  tools: {
    header: {
      class: Header,
      inlineToolbar: true,
      config: {
        levels: [2],
        defaultLevel: 2
      }
    },
    image: {
      class: SimpleImage,
      inlineToolbar: ['link'],
      toolbox: {
        title: 'Image',
        icon:
          '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><circle cx="7" cy="8" r="1.4" fill="currentColor"/><path d="M4.5 13.5L8.5 9.5L11.5 12.5L15.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
      }
    },
    linkTool: {
      class: LinkTool,
      config: {
        endpoint: '/api/link-preview'
      }
    }
  },
  data: {
    blocks: [
      {
        type: 'header',
        data: {
          text: 'Give these rich blocks a try',
          level: 2
        }
      },
      {
        type: 'paragraph',
        data: {
          text: 'Toggle the theme, edit the heading, and drop notes with the comment tool. '
        }
      },
      {
        type: 'image',
        data: {
          url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=960&q=80',
          caption: 'Sunrise tones pair nicely with the Coral + Royal palette.',
          withBorder: true,
          withBackground: false,
          stretched: false
        }
      },
      {
        type: 'linkTool',
        data: {
          link: 'https://editorjs.io',
          meta: {
            title: 'Editor.js — Next generation block editor',
            description:
              'Block-styled editor with clean JSON output. Perfect for creating flexible content models.',
            site_name: 'editorjs.io',
            image: {
              url: 'https://avatars.githubusercontent.com/u/15302092?s=200&v=4'
            }
          }
        }
      }
    ]
  }
})

const serializeEditor = () => editor.save()

const sanitizeExcerpt = (text = '') =>
  text.replace(/<[^>]+>/g, '').trim().slice(0, 120)

let snackbarTimeout
const showSnackbar = (message) => {
  if (!snackbar) {
    return
  }

  snackbar.textContent = message
  snackbar.classList.add('is-visible')

  clearTimeout(snackbarTimeout)
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('is-visible')
  }, 2400)
}

const showOverlay = () => {
  overlay?.classList.add('is-visible')
  overlay?.setAttribute('aria-hidden', 'false')
}

const hideOverlayIfIdle = () => {
  const dataOpen = dataPanel?.classList.contains('is-open')
  const modalOpen =
    unlockModal?.classList.contains('is-open') ||
    waitlistModal?.classList.contains('is-open')
  if (!dataOpen && !modalOpen) {
    overlay?.classList.remove('is-visible')
    overlay?.setAttribute('aria-hidden', 'true')
  }
}

const openDataPanel = () => {
  dataPanel?.classList.add('is-open')
  dataPanel?.setAttribute('aria-hidden', 'false')
  showOverlay()
}

const closeDataPanel = () => {
  dataPanel?.classList.remove('is-open')
  dataPanel?.setAttribute('aria-hidden', 'true')
  hideOverlayIfIdle()
}

const toggleDataPanel = () => {
  if (dataPanel?.classList.contains('is-open')) {
    closeDataPanel()
  } else {
    openDataPanel()
  }
}

const closeUnlockModal = () => {
  unlockModal?.classList.remove('is-open')
  unlockModal?.setAttribute('aria-hidden', 'true')
  unlockError.textContent = ''
  unlockForm?.reset()
  hideOverlayIfIdle()
}

const openUnlockModal = () => {
  if (isUnlocked) {
    return
  }
  unlockModal?.classList.add('is-open')
  unlockModal?.setAttribute('aria-hidden', 'false')
  showOverlay()
  unlockInput?.focus()
}

const closeWaitlistModal = () => {
  waitlistModal?.classList.remove('is-open')
  waitlistModal?.setAttribute('aria-hidden', 'true')
  waitlistError.textContent = ''
  waitlistForm?.reset()
  hideOverlayIfIdle()
}

const openWaitlistModal = () => {
  waitlistModal?.classList.add('is-open')
  waitlistModal?.setAttribute('aria-hidden', 'false')
  showOverlay()
  waitlistName?.focus()
}

const verifyPassword = async (password) => {
  const passwordQuery = query(adminsRef, where('password', '==', password))
  const snapshot = await getDocs(passwordQuery)
  return !snapshot.empty
}

const setEditingAvailability = (state) => {
  isUnlocked = state
  gatingButtons.forEach((button) => {
    if (!button) {
      return
    }
    button.disabled = !state
    button.classList.toggle('is-disabled', !state)
  })

  if (unlockDock) {
    unlockDock.textContent = state ? 'Editing enabled' : 'Unlock editing'
    unlockDock.classList.toggle('is-active', state)
    unlockDock.disabled = state
  }

  editor.isReady.then(() => {
    editor.readOnly.toggle(!state)
  })
}

const saveDocument = async ({ silent = false } = {}) => {
  if (!isUnlocked || isSaving) {
    return
  }

  isSaving = true
  try {
    const savedData = await serializeEditor()
    latestContent = savedData
    if (!silent && output) {
      output.textContent = JSON.stringify(savedData, null, 2)
    }
    await setDoc(
      docRef,
      {
        content: savedData,
        updatedAt: serverTimestamp(),
        comments
      },
      { merge: true }
    )

    if (!silent) {
      openDataPanel()
      showSnackbar('Document saved to Firebase')
    }
  } catch (error) {
    if (!silent && output) {
      output.textContent = `Saving failed: ${error.message}`
    }
  } finally {
    isSaving = false
  }
}

const startAutoSave = () => {
  if (autoSaveTimer) {
    return
  }

  autoSaveTimer = setInterval(() => {
    saveDocument({ silent: true })
  }, AUTO_SAVE_INTERVAL)
}

const loadDocument = async () => {
  try {
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      const data = snapshot.data()
      latestContent = data.content
      await editor.render(latestContent)
      comments.splice(0, comments.length, ...(data.comments || []))
      renderComments()
    }
  } catch (error) {
    console.error('Failed to load document', error)
  }
}

const insertHeading = async () => {
  if (!isUnlocked) {
    openUnlockModal()
    return
  }
  await editor.isReady
  editor.blocks.insert('header', {
    text: 'New section title',
    level: 2
  })
}

const insertImage = async () => {
  if (!isUnlocked) {
    openUnlockModal()
    return
  }
  await editor.isReady
  const url = window.prompt('Image URL to embed?')
  if (!url) {
    return
  }
  const caption = window.prompt('Optional caption?') || ''

  editor.blocks.insert('image', {
    url,
    caption,
    withBorder: true,
    withBackground: false,
    stretched: false
  })
}

const insertLink = async () => {
  if (!isUnlocked) {
    openUnlockModal()
    return
  }
  await editor.isReady
  const url = window.prompt('Link to preview?')
  if (!url) {
    return
  }

  editor.blocks.insert('linkTool', {
    link: url
  })
}

setEditingAvailability(false)

editor.isReady.then(() => {
  startAutoSave()
})

const themeOptions = [
  { name: 'sunrise', label: 'Sunrise' },
  { name: 'midnight', label: 'Midnight' }
]
const THEME_STORAGE_KEY = 'editor-theme-preference'
const storage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
let activeThemeIndex = (() => {
  if (!storage) {
    return 0
  }
  const savedTheme = storage.getItem(THEME_STORAGE_KEY)
  const savedIndex = themeOptions.findIndex((theme) => theme.name === savedTheme)
  return savedIndex >= 0 ? savedIndex : 0
})()

const applyTheme = (index) => {
  activeThemeIndex = index % themeOptions.length
  const currentTheme = themeOptions[activeThemeIndex]
  const nextTheme = themeOptions[(activeThemeIndex + 1) % themeOptions.length]

  if (currentTheme.name === 'sunrise') {
    document.body.removeAttribute('data-theme')
  } else {
    document.body.dataset.theme = currentTheme.name
  }

  if (themeToggleButton) {
    themeToggleButton.textContent = `Switch to ${nextTheme.label}`
  }

  storage?.setItem(THEME_STORAGE_KEY, currentTheme.name)
}

themeToggleButton?.addEventListener('click', () => {
  applyTheme(activeThemeIndex + 1)
})

applyTheme(activeThemeIndex)

headingButton?.addEventListener('click', insertHeading)
imageButton?.addEventListener('click', insertImage)
linkButton?.addEventListener('click', insertLink)

dataToggle?.addEventListener('click', toggleDataPanel)
panelCloseButtons.forEach((btn) => btn.addEventListener('click', closeDataPanel))
overlay?.addEventListener('click', () => {
  closeDataPanel()
  closeUnlockModal()
  closeWaitlistModal()
})

unlockDock?.addEventListener('click', openUnlockModal)
unlockCancel?.addEventListener('click', closeUnlockModal)
waitlistDock?.addEventListener('click', openWaitlistModal)
waitlistCancel?.addEventListener('click', closeWaitlistModal)

unlockForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const password = unlockInput?.value.trim()
  if (!password) {
    unlockError.textContent = 'Password required'
    return
  }

  unlockError.textContent = ''
  try {
    const isValid = await verifyPassword(password)
    if (!isValid) {
      unlockError.textContent = 'Incorrect password'
      return
    }

    setEditingAvailability(true)
    closeUnlockModal()
    showSnackbar('Editing unlocked')
  } catch (error) {
    unlockError.textContent = 'Unable to verify password'
    console.error('Unlock failed', error)
  }
})

saveButton?.addEventListener('click', () => {
  saveDocument()
})

waitlistForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const name = waitlistName?.value.trim()
  const email = waitlistEmail?.value.trim()
  if (!name || !email) {
    waitlistError.textContent = 'Please fill in both fields.'
    return
  }

  waitlistError.textContent = ''
  try {
    await addDoc(waitlistRef, {
      name,
      email,
      createdAt: serverTimestamp()
    })
    closeWaitlistModal()
    showSnackbar('Added to waitlist')
  } catch (error) {
    waitlistError.textContent = 'Unable to submit. Try again later.'
    console.error('Waitlist submit failed', error)
  }
})

commentForm?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = commentInput?.value.trim()
  if (!text) {
    return
  }

  try {
    await editor.isReady
    const rawIndex = editor.blocks.getCurrentBlockIndex()
    const blockIndex = Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0
    const block = latestContent?.blocks?.[blockIndex] ?? null

    const blockIndexLabel = block
      ? `Block #${blockIndex + 1}`
      : 'Whole doc'

    const newComment = {
      id: Date.now().toString(),
      blockIndex,
      blockIndexLabel,
      blockType: block?.type ?? 'document',
      excerpt: sanitizeExcerpt(block?.data?.text),
      text,
      timestamp: new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date())
    }

    comments.unshift(newComment)
    await addDoc(commentsRef, {
      ...newComment,
      createdAt: serverTimestamp()
    })
    await setDoc(
      docRef,
      {
        comments,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )

    renderComments()
    commentInput.value = ''
  } catch (error) {
    commentList.innerHTML = `<li class="comment-error">Unable to add comment: ${error.message}</li>`
  }
})

loadDocument().finally(renderComments)
