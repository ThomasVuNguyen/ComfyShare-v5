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
      <aside class="editor-actions">
        <button id="save-button" type="button">Save content</button>
        <p class="hint">Click save to serialize the blocks below.</p>
      </aside>
    </section>
    <pre id="output" class="editor-output" aria-live="polite"></pre>
  </main>
`

const output = document.getElementById('output')
const saveButton = document.getElementById('save-button')

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

saveButton?.addEventListener('click', () => {
  editor
    .save()
    .then((savedData) => {
      output.textContent = JSON.stringify(savedData, null, 2)
    })
    .catch((error) => {
      output.textContent = `Saving failed: ${error.message}`
    })
})
