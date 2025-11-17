import './style.css'
import EditorJS from '@editorjs/editorjs'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="editor-app">
    <header>
      <h1>Editor.js demo</h1>
      <p>Minimal block-style text editor built with the local Editor.js source.</p>
    </header>
    <section class="editor-shell">
      <div id="editorjs" class="editor-canvas"></div>
      <aside class="editor-sidebar">
        <div class="editor-actions">
          <button id="save-button" type="button">Save content</button>
          <p class="hint">Click save to serialize the blocks below.</p>
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
  tools: {},
  data: {
    blocks: [
      {
        type: 'paragraph',
        data: {
          text: 'Editor.js returns clean data output as structured JSON.'
        }
      }
    ]
  }
})

const serializeEditor = () => editor.save()

const sanitizeExcerpt = (text = '') =>
  text.replace(/<[^>]+>/g, '').trim().slice(0, 120)

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
