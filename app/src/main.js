import './style.css'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import SimpleImage from '@editorjs/simple-image'
import LinkTool from '@editorjs/link'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="editor-app">
    <header class="app-header">
      <div>
        <h1>Editor.js demo</h1>
        <p>Minimal block-style text editor built with the local Editor.js source.</p>
      </div>
      <button id="theme-toggle" data-variant="ghost" type="button">
        Toggle theme
      </button>
    </header>
    <section class="editor-shell">
      <div id="editorjs" class="editor-canvas"></div>
      <aside class="editor-sidebar">
        <div class="editor-actions">
          <button id="save-button" type="button">Save content</button>
          <p class="hint">Click save to serialize the blocks below.</p>
          <div class="quick-actions">
            <p class="eyebrow">Quick insert</p>
            <div class="quick-grid">
              <button id="add-heading" class="quick-button" type="button">
                Add heading
              </button>
              <button id="add-image" class="quick-button" type="button">
                Add image
              </button>
              <button id="add-link" class="quick-button" type="button">
                Add link preview
              </button>
            </div>
          </div>
        </div>
        <section class="comment-panel">
          <header class="comment-header">
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
        </section>
      </aside>
    </section>
    <pre id="output" class="editor-output" aria-live="polite"></pre>
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
const comments = []

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

const insertHeading = async () => {
  await editor.isReady
  editor.blocks.insert('header', {
    text: 'New section title',
    level: 2
  })
}

const insertImage = async () => {
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
  await editor.isReady
  const url = window.prompt('Link to preview?')
  if (!url) {
    return
  }

  editor.blocks.insert('linkTool', {
    link: url
  })
}

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

saveButton?.addEventListener('click', () => {
  serializeEditor()
    .then((savedData) => {
      output.textContent = JSON.stringify(savedData, null, 2)
    })
    .catch((error) => {
      output.textContent = `Saving failed: ${error.message}`
    })
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
    const savedData = await serializeEditor()
    const block = savedData.blocks?.[blockIndex] ?? null

    const blockIndexLabel = block
      ? `Block #${blockIndex + 1}`
      : 'Whole doc'

    comments.unshift({
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
    })

    renderComments()
    commentInput.value = ''
  } catch (error) {
    commentList.innerHTML = `<li class="comment-error">Unable to add comment: ${error.message}</li>`
  }
})

renderComments()
