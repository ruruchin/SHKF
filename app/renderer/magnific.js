const magnificConnectBtn = document.getElementById('magnific-connect-btn');
const magnificStatusText = document.getElementById('magnific-status-text');
const magnificStatusIndicator = document.querySelector('#magnific-status-panel .status-indicator');
const magnificToolsContainer = document.getElementById('magnific-tools-container');
const magnificToolsList = document.getElementById('magnific-tools-list');
const magnificToolTitle = document.getElementById('magnific-tool-title');
const magnificToolFormContainer = document.getElementById('magnific-tool-form-container');
const magnificToolResult = document.getElementById('magnific-tool-result');

let currentTools = [];
let selectedTool = null;

async function checkMagnificStatus() {
  const res = await window.api.magnificStatus();
  updateMagnificUI(res.isConnected);
  if (res.isConnected) {
    loadMagnificTools();
  }
}

function updateMagnificUI(isConnected) {
  if (isConnected) {
    magnificStatusText.textContent = 'Подключено к Magnific MCP';
    magnificStatusIndicator.classList.add('connected');
    magnificConnectBtn.style.display = 'none';
    magnificToolsContainer.style.display = 'flex';
  } else {
    magnificStatusText.textContent = 'Не подключено';
    magnificStatusIndicator.classList.remove('connected');
    magnificConnectBtn.style.display = 'block';
    magnificToolsContainer.style.display = 'none';
  }
}

magnificConnectBtn.addEventListener('click', async () => {
  magnificConnectBtn.disabled = true;
  magnificConnectBtn.textContent = 'Подключение...';
  try {
    const res = await window.api.magnificConnect();
    if (res.ok) {
      updateMagnificUI(true);
      loadMagnificTools();
    } else {
      alert('Ошибка подключения: ' + res.message);
      magnificConnectBtn.disabled = false;
      magnificConnectBtn.textContent = 'Подключить';
    }
  } catch (e) {
    alert('Ошибка: ' + e.message);
    magnificConnectBtn.disabled = false;
    magnificConnectBtn.textContent = 'Подключить';
  }
});

async function loadMagnificTools() {
  magnificToolsList.innerHTML = '<li>Загрузка инструментов...</li>';
  const res = await window.api.magnificGetTools();
  if (res.ok) {
    currentTools = res.tools;
    renderToolsList();
  } else {
    magnificToolsList.innerHTML = `<li>Ошибка: ${res.message}</li>`;
  }
}

function renderToolsList() {
  magnificToolsList.innerHTML = '';
  currentTools.forEach(tool => {
    const li = document.createElement('li');
    li.className = 'magnific-tool-item';
    li.innerHTML = `
      <div class="magnific-tool-name">${tool.name}</div>
      <div class="magnific-tool-desc">${tool.description || ''}</div>
    `;
    li.addEventListener('click', () => {
      document.querySelectorAll('.magnific-tool-item').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      selectTool(tool);
    });
    magnificToolsList.appendChild(li);
  });
}

function selectTool(tool) {
  selectedTool = tool;
  magnificToolTitle.textContent = tool.name;
  magnificToolResult.innerHTML = '';
  renderToolForm(tool);
}

function renderToolForm(tool) {
  magnificToolFormContainer.innerHTML = '';
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) {
    magnificToolFormContainer.innerHTML = '<p>Этот инструмент не требует параметров.</p>';
  } else {
    Object.entries(schema.properties).forEach(([key, prop]) => {
      const group = document.createElement('div');
      group.className = 'magnific-form-group';
      
      const label = document.createElement('label');
      label.textContent = `${key} ${schema.required?.includes(key) ? '*' : ''}`;
      if (prop.description) {
        label.title = prop.description;
      }
      group.appendChild(label);

      let input;
      if (prop.enum) {
        input = document.createElement('select');
        input.name = key;
        if (!schema.required?.includes(key)) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '-- Не выбрано --';
          input.appendChild(opt);
        }
        prop.enum.forEach(val => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          input.appendChild(opt);
        });
      } else if (prop.type === 'boolean') {
        input = document.createElement('select');
        input.name = key;
        input.innerHTML = `
          <option value="">-- Не выбрано --</option>
          <option value="true">Да</option>
          <option value="false">Нет</option>
        `;
      } else if (prop.type === 'number' || prop.type === 'integer') {
        input = document.createElement('input');
        input.type = 'number';
        input.name = key;
        if (prop.default !== undefined) input.value = prop.default;
      } else {
        if (key.includes('prompt') || prop.description?.includes('prompt')) {
          input = document.createElement('textarea');
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }
        input.name = key;
        if (prop.default !== undefined) input.value = prop.default;
      }
      
      if (schema.required?.includes(key)) {
        input.required = true;
      }
      
      group.appendChild(input);
      magnificToolFormContainer.appendChild(group);
    });
  }

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary magnific-submit-btn';
  submitBtn.textContent = 'Выполнить';
  submitBtn.addEventListener('click', () => submitToolForm(tool));
  magnificToolFormContainer.appendChild(submitBtn);
}

async function submitToolForm(tool) {
  const args = {};
  const inputs = magnificToolFormContainer.querySelectorAll('input, select, textarea');
  let valid = true;
  
  inputs.forEach(input => {
    if (input.required && !input.value) {
      valid = false;
      input.style.borderColor = 'red';
    } else {
      input.style.borderColor = '';
      if (input.value !== '') {
        let val = input.value;
        if (input.type === 'number') val = Number(val);
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        args[input.name] = val;
      }
    }
  });

  if (!valid) return;

  const submitBtn = magnificToolFormContainer.querySelector('.magnific-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="magnific-loading"></span> Выполнение...';
  magnificToolResult.innerHTML = '';

  try {
    const res = await window.api.magnificCallTool({ name: tool.name, arguments: args });
    if (res.ok) {
      renderToolResult(res.result);
    } else {
      magnificToolResult.innerHTML = `<div class="error">Ошибка: ${res.message}</div>`;
    }
  } catch (e) {
    magnificToolResult.innerHTML = `<div class="error">Ошибка: ${e.message}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Выполнить';
  }
}

function renderToolResult(result) {
  magnificToolResult.innerHTML = '<h4>Результат:</h4>';
  
  if (result.content && Array.isArray(result.content)) {
    result.content.forEach(item => {
      if (item.type === 'text') {
        const pre = document.createElement('pre');
        pre.className = 'magnific-result-content';
        pre.textContent = item.text;
        magnificToolResult.appendChild(pre);
      } else if (item.type === 'image') {
        const img = document.createElement('img');
        img.className = 'magnific-result-image';
        img.src = `data:${item.mimeType || 'image/png'};base64,${item.data}`;
        magnificToolResult.appendChild(img);
      }
    });
  } else {
    const pre = document.createElement('pre');
    pre.className = 'magnific-result-content';
    pre.textContent = JSON.stringify(result, null, 2);
    magnificToolResult.appendChild(pre);
  }
}

// Check status on load
document.addEventListener('DOMContentLoaded', () => {
  checkMagnificStatus();
});

window.activateMagnificPage = () => {
  checkMagnificStatus();
};
