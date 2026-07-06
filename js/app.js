const CONFIG = {
  API_URL: '/zen/v1/chat/completions',
  API_BASE: 'https://opencode.ai',
  MODELS: ['deepseek-v4-flash-free', 'big-pickle', 'mimo-v2.5-free', 'north-mini-code-free', 'nemotron-3-ultra-free'],
  WORKSPACE: '/mnt/sdcard/mkai',
  HISTORY_KEY: 'mkzen_chat_history',
  SETTINGS_KEY: 'mkzen_settings',
  CHATS_KEY: 'mkzen_chats'
};

const app = {
  state: { currentTool: null, generating: false, abortController: null },
  init() {
    this.loadSettings();
    this.initEventListeners();
    this.initAutoResize();
    sidebar.init();
    settings.init();
    tools.init();
    chat.init();
  },
  loadSettings() {
    const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
    if (saved) {
      try { Object.assign(settings.state, JSON.parse(saved)); } catch(e) {}
    }
    settings.applyAll();
  },
  initEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
        if (settings.panel.classList.contains('active')) settings.toggle();
      }
    });
  },
  initAutoResize() {
    const ta = document.getElementById('message-input');
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    });
  },
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
  },
  showToolModal(tool) {
    this.state.currentTool = tool;
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');
    modal.classList.remove('hidden');
    body.innerHTML = '';
    footer.innerHTML = '';
    switch(tool) {
      case 'file_create': {
        title.textContent = 'Create File';
        body.innerHTML = `
          <label for="tool-file-path">File Path (relative to workspace)</label>
          <input type="text" id="tool-file-path" placeholder="path/to/file.js" value="">
          <label for="tool-file-content">Content</label>
          <textarea id="tool-file-content" rows="8" placeholder="File content..."></textarea>`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" onclick="tools.createFile()">Create</button>`;
        break;
      }
      case 'folder_create': {
        title.textContent = 'Create Folder';
        body.innerHTML = `
          <label for="tool-folder-path">Folder Path (relative to workspace)</label>
          <input type="text" id="tool-folder-path" placeholder="path/to/new-folder">`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" onclick="tools.createFolder()">Create</button>`;
        break;
      }
      case 'file_read': {
        title.textContent = 'Read File';
        body.innerHTML = `
          <label for="tool-read-path">File Path (relative to workspace)</label>
          <input type="text" id="tool-read-path" placeholder="path/to/file.js">`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" onclick="tools.readFile()">Read</button>`;
        break;
      }
      case 'file_edit': {
        title.textContent = 'Edit File';
        body.innerHTML = `
          <label for="tool-edit-path">File Path (relative to workspace)</label>
          <input type="text" id="tool-edit-path" placeholder="path/to/file.js">
          <label for="tool-edit-old">Text to Replace</label>
          <textarea id="tool-edit-old" rows="3" placeholder="Original text..."></textarea>
          <label for="tool-edit-new">New Text</label>
          <textarea id="tool-edit-new" rows="3" placeholder="New text..."></textarea>`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" onclick="tools.editFile()">Apply Edit</button>`;
        break;
      }
      case 'file_delete': {
        title.textContent = 'Delete File/Folder';
        body.innerHTML = `
          <label for="tool-delete-path">Path to Delete (relative to workspace)</label>
          <input type="text" id="tool-delete-path" placeholder="path/to/file-or-folder">
          <p style="color:var(--red);font-size:0.8rem;margin-top:4px;">Warning: This action cannot be undone.</p>`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" style="background:var(--red)" onclick="tools.deleteItem()">Delete</button>`;
        break;
      }
      case 'web_search': {
        title.textContent = 'Web Search';
        body.innerHTML = `
          <label for="tool-search-query">Search Query</label>
          <input type="text" id="tool-search-query" placeholder="Enter search query...">
          <label for="tool-search-num">Number of Results</label>
          <select id="tool-search-num"><option value="5">5</option><option value="8" selected>8</option><option value="12">12</option></select>`;
        footer.innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Cancel</button><button class="modal-btn primary" onclick="tools.webSearch()">Search</button>`;
        break;
      }
    }
    document.getElementById('modal-overlay').querySelector('input')?.focus();
  },
  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this.state.currentTool = null;
  },
  showSearchModal() {
    this.showToolModal('web_search');
  }
};

const sidebar = {
  el: null,
  overlay: null,
  init() {
    this.el = document.getElementById('sidebar');
    this.overlay = document.getElementById('sidebar-overlay');
  },
  toggle() {
    const isOpen = this.el.classList.toggle('open');
    this.overlay.classList.toggle('active', isOpen);
  },
  switchTab(tab) {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  }
};

const settings = {
  panel: null,
  state: {
    model: 'deepseek-v4-flash-free',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    codeTheme: 'one-dark',
    autoScroll: true,
    stream: true,
    showThinking: true,
    enterToSend: true,
    markdown: true
  },
  init() {
    this.panel = document.getElementById('settings-panel');
  },
  toggle() {
    this.panel.classList.toggle('active');
    document.getElementById('settings-overlay').classList.toggle('active', this.panel.classList.contains('active'));
  },
  apply(key, value) {
    if (key === 'temperature') {
      this.state.temperature = parseFloat(value);
      document.getElementById('temp-value').textContent = value;
    } else if (key === 'maxTokens') {
      this.state.maxTokens = parseInt(value);
      document.getElementById('maxtokens-value').textContent = value;
    } else if (key === 'fontSize') {
      this.state.fontSize = parseInt(value);
      document.getElementById('fontsize-value').textContent = value;
    } else {
      this.state[key] = value;
    }
    localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(this.state));
    this.applySetting(key);
  },
  applySetting(key) {
    switch(key) {
      case 'theme':
        document.documentElement.setAttribute('data-theme', this.state.theme);
        if (this.state.theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
        break;
      case 'fontSize':
        document.documentElement.style.fontSize = this.state.fontSize + 'px';
        break;
      case 'fontFamily':
        document.body.style.fontFamily = this.state.fontFamily;
        break;
      case 'model':
        document.getElementById('header-model').textContent = this.state.model;
        document.getElementById('input-model-badge').textContent = this.state.model;
        break;
      case 'enterToSend':
        break;
    }
  },
  applyAll() {
    Object.keys(this.state).forEach(key => this.applySetting(key));
    document.getElementById('setting-model').value = this.state.model;
    document.getElementById('setting-temperature').value = this.state.temperature;
    document.getElementById('temp-value').textContent = this.state.temperature;
    document.getElementById('setting-max-tokens').value = this.state.maxTokens;
    document.getElementById('maxtokens-value').textContent = this.state.maxTokens;
    document.getElementById('setting-system-prompt').value = this.state.systemPrompt;
    document.getElementById('setting-theme').value = this.state.theme;
    document.getElementById('setting-font-size').value = this.state.fontSize;
    document.getElementById('fontsize-value').textContent = this.state.fontSize;
    document.getElementById('setting-font-family').value = this.state.fontFamily;
    document.getElementById('setting-auto-scroll').checked = this.state.autoScroll;
    document.getElementById('setting-stream').checked = this.state.stream;
    document.getElementById('setting-show-thinking').checked = this.state.showThinking;
    document.getElementById('setting-enter-send').checked = this.state.enterToSend;
    document.getElementById('setting-markdown').checked = this.state.markdown;
  }
};

const tools = {
  init() {
    this.refreshWorkspace();
  },
  async createFile() {
    const path = document.getElementById('tool-file-path').value.trim();
    const content = document.getElementById('tool-file-content').value;
    if (!path) { app.showToast('Please enter a file path', 'error'); return; }
    const fullPath = CONFIG.WORKSPACE + '/' + path;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    try {
      await tools._exec(`mkdir -p "${dir}"`);
      await tools._exec(`cat > "${fullPath}" << 'ENDOFFILE'\n${content}\nENDOFFILE`);
      app.showToast(`File created: ${path}`, 'success');
      app.closeModal();
      this.refreshWorkspace();
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  async createFolder() {
    const path = document.getElementById('tool-folder-path').value.trim();
    if (!path) { app.showToast('Please enter a folder path', 'error'); return; }
    try {
      await tools._exec(`mkdir -p "${CONFIG.WORKSPACE}/${path}"`);
      app.showToast(`Folder created: ${path}`, 'success');
      app.closeModal();
      this.refreshWorkspace();
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  async readFile() {
    const path = document.getElementById('tool-read-path').value.trim();
    if (!path) { app.showToast('Please enter a file path', 'error'); return; }
    try {
      const result = await tools._exec(`cat "${CONFIG.WORKSPACE}/${path}"`);
      const body = document.getElementById('modal-body');
      body.innerHTML = `
        <label>File: ${path}</label>
        <pre style="background:var(--bg-primary);padding:12px;border-radius:8px;overflow:auto;max-height:400px;font-size:0.8rem;line-height:1.5;color:var(--text-primary)"><code>${tools._escapeHtml(result.stdout || '')}</code></pre>`;
      document.getElementById('modal-footer').innerHTML = `<button class="modal-btn primary" onclick="app.closeModal()">Close</button>`;
      app.showToast('File read successfully', 'success');
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  async editFile() {
    const path = document.getElementById('tool-edit-path').value.trim();
    const old = document.getElementById('tool-edit-old').value;
    const newText = document.getElementById('tool-edit-new').value;
    if (!path || !old) { app.showToast('Please fill all fields', 'error'); return; }
    try {
      const fullPath = `${CONFIG.WORKSPACE}/${path}`;
      const result = await tools._exec(`cat "${fullPath}"`);
      const content = result.stdout || '';
      if (!content.includes(old)) { app.showToast('Text not found in file', 'error'); return; }
      const newContent = content.replace(old, newText);
      const escaped = newContent.replace(/'/g, "'\\''");
      await tools._exec(`cat > "${fullPath}" << 'ENDOFFILE'\n${newContent}\nENDOFFILE`);
      app.showToast('File edited successfully', 'success');
      app.closeModal();
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  async deleteItem() {
    const path = document.getElementById('tool-delete-path').value.trim();
    if (!path) { app.showToast('Please enter a path', 'error'); return; }
    try {
      await tools._exec(`rm -rf "${CONFIG.WORKSPACE}/${path}"`);
      app.showToast(`Deleted: ${path}`, 'success');
      app.closeModal();
      this.refreshWorkspace();
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  async webSearch() {
    const query = document.getElementById('tool-search-query').value.trim();
    const num = document.getElementById('tool-search-num').value;
    if (!query) { app.showToast('Please enter a search query', 'error'); return; }
    const body = document.getElementById('modal-body');
    body.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-tertiary)">Searching...</div>`;
    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
      const data = await res.json();
      let html = `<label>Search Results for: "${query}"</label><div style="display:flex;flex-direction:column;gap:8px">`;
      if (data.RelatedTopics && data.RelatedTopics.length) {
        data.RelatedTopics.slice(0, parseInt(num)).forEach(item => {
          if (item.Text) {
            const parts = item.Text.split(' - ');
            html += `<div style="padding:8px 12px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border)">
              <div style="font-size:0.85rem;color:var(--text-primary)">${item.Text}</div>
              ${item.FirstURL ? `<a href="${item.FirstURL}" target="_blank" style="font-size:0.75rem;color:var(--blue)">${item.FirstURL}</a>` : ''}
            </div>`;
          }
        });
      } else {
        html += `<div style="color:var(--text-tertiary)">No results found</div>`;
      }
      html += `</div>`;
      body.innerHTML = html;
      document.getElementById('modal-footer').innerHTML = `<button class="modal-btn secondary" onclick="app.closeModal()">Close</button><button class="modal-btn primary" onclick="chat.sendPrompt('${query.replace(/'/g, "\\'")}')">Ask AI About This</button>`;
    } catch(e) { 
      body.innerHTML = `<div style="color:var(--red)">Search failed: ${e.message}</div>`;
      document.getElementById('modal-footer').innerHTML = `<button class="modal-btn primary" onclick="app.closeModal()">Close</button>`;
    }
  },
  async refreshWorkspace() {
    const tree = document.getElementById('workspace-tree');
    try {
      const result = await tools._exec(`ls -la "${CONFIG.WORKSPACE}" 2>/dev/null | head -50`);
      if (!result.stdout) { tree.innerHTML = '<div class="tree-empty">Workspace is empty</div>'; return; }
      let html = '';
      const lines = result.stdout.split('\n').filter(l => l && !l.startsWith('total'));
      lines.forEach(line => {
        const parts = line.split(/\s+/);
        if (parts.length < 9) return;
        const perms = parts[0];
        const name = parts.slice(8).join(' ');
        if (name === '.' || name === '..') return;
        const isDir = perms.startsWith('d');
        const icon = isDir ? 
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fdcb6e" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' :
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        html += `<div class="tree-item ${isDir ? 'folder' : 'file'}" onclick="${isDir ? '' : `chat.sendPrompt('Read the file ${name}')`}">
          ${icon}<span>${tools._escapeHtml(name)}</span>
        </div>`;
      });
      tree.innerHTML = html || '<div class="tree-empty">Workspace is empty</div>';
    } catch(e) {
      tree.innerHTML = `<div class="tree-empty">Error loading workspace</div>`;
    }
  },
  async downloadWorkspace() {
    app.showToast('Preparing workspace download...', 'info');
    try {
      const result = await tools._exec(`zip -r /tmp/workspace.zip "${CONFIG.WORKSPACE}" -x "*.git*" "*/node_modules/*" 2>&1`);
      app.showToast('Workspace zipped. Use the link below to download.', 'success');
      const link = document.createElement('a');
      link.href = 'file:///tmp/workspace.zip';
      link.download = 'workspace.zip';
      link.textContent = 'Download workspace.zip';
      link.style.cssText = 'display:block;text-align:center;padding:12px;color:var(--accent);font-weight:500;margin-top:8px';
      const tree = document.getElementById('workspace-tree');
      tree.innerHTML = `<div style="text-align:center;padding:20px"><div style="color:var(--green);margin-bottom:8px">Workspace downloaded!</div>${link.outerHTML}</div>`;
    } catch(e) { app.showToast(`Error: ${e.message}`, 'error'); }
  },
  openFilePicker() {
    document.getElementById('file-picker').click();
  },
  handleFilePick(event) {
    const files = event.target.files;
    if (!files.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      document.getElementById('message-input').value = `I've uploaded a file. Here's its content:\n\n\`\`\`\n${content.substring(0, 4000)}\n\`\`\`\n\nPlease analyze this.`;
      document.getElementById('message-input').dispatchEvent(new Event('input'));
    };
    reader.readAsText(files[0]);
  },
  async _exec(cmd) {
    const response = await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    if (!response.ok) throw new Error(`Command failed: ${response.statusText}`);
    return await response.json();
  },
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  async _execDirect(cmd) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/exec', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(xhr.statusText));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(JSON.stringify({ command: cmd }));
    });
  }
};

const chat = {
  messages: [],
  history: [],
  currentHistoryId: null,
  init() {
    this.loadHistory();
    this.setupInput();
  },
  setupInput() {
    const input = document.getElementById('message-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && settings.state.enterToSend && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  },
  sendMessage() {
    if (app.state.generating) return;
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;
    this.addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('welcome-screen')?.classList.add('hidden');
    this.generateResponse();
  },
  sendPrompt(text) {
    document.getElementById('message-input').value = text;
    this.sendMessage();
  },
  addMessage(role, content, reasoning = null) {
    const container = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.dataset.content = content;
    if (reasoning) msgDiv.dataset.reasoning = reasoning;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'Z';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'assistant' && reasoning && settings.state.showThinking) {
      const thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'thinking-block';
      const thinkingHeader = document.createElement('div');
      thinkingHeader.className = 'thinking-header';
      thinkingHeader.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <span>Thinking</span>`;
      const thinkingContent = document.createElement('div');
      thinkingContent.className = 'thinking-content';
      thinkingContent.textContent = reasoning;
      thinkingHeader.addEventListener('click', () => {
        thinkingHeader.classList.toggle('collapsed');
        thinkingContent.classList.toggle('collapsed');
      });
      thinkingBlock.appendChild(thinkingHeader);
      thinkingBlock.appendChild(thinkingContent);
      bubble.appendChild(thinkingBlock);
    }

    const contentPara = document.createElement('div');
    contentPara.className = 'message-text';
    if (settings.state.markdown && role === 'assistant') {
      contentPara.innerHTML = this.renderMarkdown(content);
    } else {
      contentPara.textContent = content;
    }
    bubble.appendChild(contentPara);

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-action-btn';
    copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy'; }, 2000);
      });
    };
    actions.appendChild(copyBtn);
    contentDiv.appendChild(bubble);
    contentDiv.appendChild(actions);

    if (role === 'user') {
      msgDiv.appendChild(contentDiv);
      msgDiv.appendChild(avatar);
    } else {
      msgDiv.appendChild(avatar);
      msgDiv.appendChild(contentDiv);
    }

    container.appendChild(msgDiv);
    this.scrollToBottom();

    this.messages.push({ role, content, reasoning });
  },
  updateLastMessage(content, reasoning = null) {
    const container = document.getElementById('messages');
    const lastMsg = container.querySelector('.message.assistant:last-child');
    if (!lastMsg) return;
    lastMsg.dataset.content = content;
    const textDiv = lastMsg.querySelector('.message-text');
    if (textDiv) {
      if (settings.state.markdown) {
        textDiv.innerHTML = this.renderMarkdown(content);
      } else {
        textDiv.textContent = content.substring(0, 50000);
      }
    }
    if (reasoning) {
      lastMsg.dataset.reasoning = reasoning;
      const tc = lastMsg.querySelector('.thinking-content');
      if (tc) tc.textContent = reasoning;
    }
    this.scrollToBottom();
  },
  async generateResponse() {
    app.state.generating = true;
    document.getElementById('send-btn').classList.add('hidden');
    document.getElementById('stop-btn').classList.remove('hidden');
    document.getElementById('typing-indicator').classList.remove('hidden');
    document.getElementById('typing-tokens').textContent = '0';

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'Z';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    bubble.appendChild(textDiv);
    contentDiv.appendChild(bubble);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    document.getElementById('messages').appendChild(msgDiv);

    const messages = [];
    if (settings.state.systemPrompt) {
      messages.push({ role: 'system', content: settings.state.systemPrompt });
    }
    for (const msg of this.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    let fullContent = '';
    let fullReasoning = '';
    let tokenCount = 0;
    let reasoningTag = false;
    let contentTag = false;

    try {
      const response = await fetch(`${CONFIG.API_BASE}/zen/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          model: settings.state.model,
          messages: messages,
          temperature: settings.state.temperature,
          max_tokens: settings.state.maxTokens,
          stream: settings.state.stream
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText}`);
      }

      if (settings.state.stream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        app.state.abortController = new AbortController();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const json = JSON.parse(jsonStr);
                const delta = json.choices?.[0]?.delta;
                if (delta) {
                  if (delta.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                    reasoningTag = true;
                  }
                  if (delta.content) {
                    fullContent += delta.content;
                    contentTag = true;
                  }
                  tokenCount++;
                  document.getElementById('typing-tokens').textContent = tokenCount;

                  if (contentTag) {
                    if (settings.state.markdown) {
                      textDiv.innerHTML = chat.renderMarkdown(fullContent + '...');
                    } else {
                      textDiv.textContent = fullContent;
                    }
                  }
                  if (reasoningTag && settings.state.showThinking) {
                    if (!msgDiv.querySelector('.thinking-block')) {
                      const thinkingBlock = document.createElement('div');
                      thinkingBlock.className = 'thinking-block';
                      thinkingBlock.innerHTML = `
                        <div class="thinking-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                          <span>Thinking</span>
                        </div>
                        <div class="thinking-content">${fullReasoning}</div>`;
                      thinkingBlock.querySelector('.thinking-header').addEventListener('click', function() {
                        this.classList.toggle('collapsed');
                        this.nextElementSibling.classList.toggle('collapsed');
                      });
                      textDiv.before(thinkingBlock);
                    } else {
                      const tc = msgDiv.querySelector('.thinking-content');
                      if (tc) tc.textContent = fullReasoning;
                    }
                  }
                  this.scrollToBottom();
                }
              } catch(e) {}
            }
          }
        }
      } else {
        const data = await response.json();
        const choice = data.choices?.[0];
        if (choice) {
          fullContent = choice.message?.content || '';
          fullReasoning = choice.message?.reasoning_content || '';
          if (fullReasoning && settings.state.showThinking) {
            const thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            thinkingBlock.innerHTML = `
              <div class="thinking-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                <span>Thinking</span>
              </div>
              <div class="thinking-content">${this.renderMarkdown(fullReasoning)}</div>`;
            thinkingBlock.querySelector('.thinking-header').addEventListener('click', function() {
              this.classList.toggle('collapsed');
              this.nextElementSibling.classList.toggle('collapsed');
            });
            textDiv.before(thinkingBlock);
          }
          if (settings.state.markdown) {
            textDiv.innerHTML = this.renderMarkdown(fullContent);
          } else {
            textDiv.textContent = fullContent;
          }
        }
      }

      this.messages.push({ role: 'assistant', content: fullContent, reasoning: fullReasoning });

      const actions = document.createElement('div');
      actions.className = 'message-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'message-action-btn';
      copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(fullContent).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy'; }, 2000);
        });
      };
      actions.appendChild(copyBtn);
      contentDiv.appendChild(actions);

      this.saveHistory();
    } catch(e) {
      textDiv.textContent = `Error: ${e.message}`;
      app.showToast(`Error: ${e.message}`, 'error');
    }

    app.state.generating = false;
    document.getElementById('send-btn').classList.remove('hidden');
    document.getElementById('stop-btn').classList.add('hidden');
    document.getElementById('typing-indicator').classList.add('hidden');
  },
  stopGeneration() {
    if (app.state.abortController) {
      app.state.abortController.abort();
    }
    app.state.generating = false;
    document.getElementById('send-btn').classList.remove('hidden');
    document.getElementById('stop-btn').classList.add('hidden');
    document.getElementById('typing-indicator').classList.add('hidden');
  },
  renderMarkdown(text) {
    if (!text) return '';
    let html = text;

    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const langLabel = lang || 'code';
      return `<pre><div class="code-header"><span>${langLabel}</span><button class="copy-btn" onclick="(function(btn){var code=btn.parentElement.nextElementSibling.textContent;navigator.clipboard.writeText(code).then(function(){btn.textContent='Copied!';btn.classList.add('copied');setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied')},2000)})})(this)">Copy</button></div><code class="language-${langLabel}">${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function(m) {
      if (!m.includes('<ol>')) return '<ol>' + m.replace(/\n/g, '') + '</ol>';
      return m;
    });

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<\/p><p><\/?[^>]*>/g, function(m) {
      const inner = m.replace('</p><p>', '');
      if (inner.startsWith('<')) return m;
      return m;
    });
    html = html.replace(/<p><(h[1-6]|ul|ol|li|blockquote|pre|div)/g, '<$1');
    html = html.replace(/\/(h[1-6]|ul|ol|li|blockquote|pre|div)><\/p>/g, '/$1>');

    return html;
  },
  scrollToBottom() {
    if (settings.state.autoScroll) {
      const container = document.getElementById('chat-container');
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }
  },
  newChat() {
    this.messages = [];
    this.currentHistoryId = null;
    document.getElementById('messages').innerHTML = `
      <div class="welcome-screen" id="welcome-screen">
        <div class="welcome-logo"><img src="assets/logo.svg" alt="MK Zen Chat" width="80" height="80"></div>
        <h2 class="welcome-title">Welcome to MK Zen Chat</h2>
        <p class="welcome-subtitle">Powered by DeepSeek V4 - Free & Unlimited</p>
        <div class="welcome-features">
          <div class="welcome-feature"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>File Editor</span></div>
          <div class="welcome-feature"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00cec9" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Web Search</span></div>
          <div class="welcome-feature"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fdcb6e" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Code Highlight</span></div>
          <div class="welcome-feature"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e17055" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg><span>Thinking Mode</span></div>
        </div>
        <div class="welcome-prompts">
          <button class="prompt-chip" onclick="chat.sendPrompt('Write a Python script to organize files by extension')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Write Python script</button>
          <button class="prompt-chip" onclick="chat.sendPrompt('Create a React component for a modal dialog')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>Create React modal</button>
          <button class="prompt-chip" onclick="chat.sendPrompt('Explain how transformers work in AI')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Explain transformers</button>
          <button class="prompt-chip" onclick="chat.sendPrompt('Analyze this code and suggest improvements')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Code review</button>
        </div>
      </div>`;
  },
  saveHistory() {
    if (this.messages.length < 2) return;
    const firstMsg = this.messages.find(m => m.role === 'user');
    if (!firstMsg) return;
    const title = firstMsg.content.substring(0, 60) + (firstMsg.content.length > 60 ? '...' : '');
    const entry = {
      id: this.currentHistoryId || Date.now().toString(),
      title,
      timestamp: Date.now(),
      messages: JSON.parse(JSON.stringify(this.messages))
    };
    if (!this.currentHistoryId) {
      this.currentHistoryId = entry.id;
      this.history.unshift(entry);
    } else {
      const idx = this.history.findIndex(h => h.id === this.currentHistoryId);
      if (idx >= 0) this.history[idx] = entry;
      else this.history.unshift(entry);
    }
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(this.history));
    this.renderHistory();
  },
  loadHistory() {
    try {
      const saved = localStorage.getItem(CONFIG.HISTORY_KEY);
      if (saved) this.history = JSON.parse(saved);
    } catch(e) {}
    this.renderHistory();
  },
  renderHistory() {
    const list = document.getElementById('history-list');
    if (!this.history.length) {
      list.innerHTML = '<div class="tree-empty">No chat history yet</div>';
      return;
    }
    let html = '';
    this.history.forEach(item => {
      const date = new Date(item.timestamp);
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += `<div class="history-item" onclick="chat.loadChat('${item.id}')">
        <div class="history-item-content">
          <div class="history-item-title">${item.title}</div>
          <div class="history-item-meta">${dateStr} - ${item.messages.length} messages</div>
        </div>
        <button class="history-item-delete" onclick="event.stopPropagation();chat.deleteHistory('${item.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>`;
    });
    list.innerHTML = html;
  },
  loadChat(id) {
    const entry = this.history.find(h => h.id === id);
    if (!entry) return;
    this.messages = JSON.parse(JSON.stringify(entry.messages));
    this.currentHistoryId = entry.id;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('welcome-screen')?.classList.add('hidden');
    this.messages.forEach(msg => {
      this.addMessage(msg.role, msg.content, msg.reasoning);
    });
    this.scrollToBottom();
  },
  deleteHistory(id) {
    this.history = this.history.filter(h => h.id !== id);
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(this.history));
    this.renderHistory();
    if (this.currentHistoryId === id) this.newChat();
  },
  clearAllHistory() {
    if (confirm('Clear all chat history? This cannot be undone.')) {
      this.history = [];
      localStorage.removeItem(CONFIG.HISTORY_KEY);
      this.renderHistory();
      this.newChat();
      app.showToast('History cleared', 'info');
    }
  },
  exportChat() {
    if (!this.messages.length) { app.showToast('No messages to export', 'error'); return; }
    const blob = new Blob([JSON.stringify({ messages: this.messages, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mk-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    app.showToast('Chat exported', 'success');
  },
  importChat(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.messages && Array.isArray(data.messages)) {
          this.messages = data.messages;
          this.currentHistoryId = null;
          document.getElementById('messages').innerHTML = '';
          document.getElementById('welcome-screen')?.classList.add('hidden');
          this.messages.forEach(msg => this.addMessage(msg.role, msg.content, msg.reasoning));
          app.showToast('Chat imported', 'success');
        }
      } catch(e) { app.showToast('Invalid file format', 'error'); }
    };
    reader.readAsText(file);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
