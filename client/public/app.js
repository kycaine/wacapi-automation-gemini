const API_BASE = 'http://localhost:3000/api';
const ADMIN_API = `${API_BASE}/admin`;
const ADMIN_TOKEN = 'wacapiautomationgemini'; // Sesuai .env

let currentClient = null;
let currentConversationId = null;

// --- Elements ---
const el = {
    navClients: document.getElementById('nav-clients'),
    navHistory: document.getElementById('nav-history'),
    clientSection: document.getElementById('clients-section'),
    knowledgeSection: document.getElementById('knowledge-section'),
    historySection: document.getElementById('history-section'),
    clientList: document.getElementById('client-list'),
    knowledgeList: document.getElementById('knowledge-list'),
    conversationList: document.getElementById('conversation-list'),
    messageContainer: document.getElementById('message-container'),
    searchHistory: document.getElementById('search-history'),
    chatHeader: document.getElementById('chat-header'),
    chatUserNumber: document.getElementById('chat-user-number'),
    chatStatus: document.getElementById('chat-status'),
    checkHuman: document.getElementById('check-human-takeover'),
    clientName: document.getElementById('current-client-name'),
    clientKey: document.getElementById('current-client-key'),
    modalClient: document.getElementById('modal-client'),
    modalKnowledge: document.getElementById('modal-knowledge'),
    modalKey: document.getElementById('modal-key'),
    newApiKey: document.getElementById('new-api-key'),
    formClient: document.getElementById('form-client'),
    formKnowledge: document.getElementById('form-knowledge'),
    toast: document.getElementById('toast'),
};

// --- API Calls ---
async function apiCall(url, method = 'GET', body = null, apiKey = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;
    else headers['x-admin-token'] = ADMIN_TOKEN;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return true;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

// --- Navigation ---
function switchSection(sectionId) {
    [el.clientSection, el.knowledgeSection, el.historySection].forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    [el.navClients, el.navHistory].forEach(n => n.classList.remove('active'));
    if (sectionId === 'clients-section') el.navClients.classList.add('active');
    if (sectionId === 'history-section') el.navHistory.classList.add('active');
}

el.navClients.onclick = () => switchSection('clients-section');
el.navHistory.onclick = () => {
    switchSection('history-section');
    if (currentClient) loadConversations();
};

// --- Renderers ---
async function loadClients() {
    try {
        const { data: clients } = await apiCall(`${ADMIN_API}/clients`);
        el.clientList.innerHTML = clients.map(client => `
            <div class="card">
                <h3>${client.name}</h3>
                <p><strong>Phone ID:</strong> ${client.whatsapp_phone_number_id}</p>
                <div class="card-actions">
                    <button class="btn btn-primary" onclick="viewKnowledge('${client.id}', '${client.name}')">Knowledge</button>
                    <button class="btn btn-secondary" onclick="viewHistory('${client.id}', '${client.name}')">History</button>
                    <button class="btn btn-secondary" onclick="editClient('${client.id}')">Edit</button>
                    <button class="btn btn-secondary" onclick="resetKey('${client.id}')">Reset Key</button>
                    <button class="btn btn-danger" onclick="deleteClient('${client.id}')">Delete</button>
                </div>
            </div>
        `).join('') || '<p>No clients found.</p>';
    } catch (err) {
        showToast(err.message);
    }
}

async function viewKnowledge(id, name) {
    await ensureClientAccess(id, name);
    switchSection('knowledge-section');
    el.clientName.textContent = name;
    el.clientKey.textContent = currentClient.apiKey;
    loadKnowledge();
}

async function viewHistory(id, name) {
    await ensureClientAccess(id, name);
    switchSection('history-section');
    loadConversations();
}

async function ensureClientAccess(id, name) {
    let apiKey = sessionStorage.getItem(`key_${id}`);
    if (!apiKey) {
        apiKey = prompt(`Please enter API Key for ${name}:`);
        if (!apiKey) throw new Error('API Key required');
        sessionStorage.setItem(`key_${id}`, apiKey);
    }
    currentClient = { id, name, apiKey };
}

async function loadKnowledge() {
    try {
        const { data: items } = await apiCall(`${API_BASE}/knowledge`, 'GET', null, currentClient.apiKey);
        el.knowledgeList.innerHTML = items.map(item => `
            <div class="list-item">
                <div class="list-item-content">
                    <h4>${item.title} <span class="badge badge-${item.type_knowledge}">${item.type_knowledge}</span></h4>
                    <p>${(item.content || '').substring(0, 100)}...</p>
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteKnowledge('${item.id}')">Delete</button>
            </div>
        `).join('') || '<p class="loading">No knowledge entries yet.</p>';
    } catch (err) {
        showToast(err.message);
    }
}

// --- History Logic ---
async function loadConversations(search = '') {
    if (!currentClient) return;
    try {
        const url = `${API_BASE}/conversations${search ? `?q=${search}` : ''}`;
        const { data: convs } = await apiCall(url, 'GET', null, currentClient.apiKey);
        el.conversationList.innerHTML = convs.map(c => `
            <div class="sidebar-item ${currentConversationId === c.id ? 'active' : ''}" onclick="openChat('${c.id}', '${c.wa_number}', '${c.is_human_active}')">
                <h4>${c.wa_number}</h4>
                <p>Status: ${c.is_human_active ? 'Human' : 'AI'}</p>
                <p><small>${new Date(c.updated_at).toLocaleString()}</small></p>
            </div>
        `).join('') || '<p class="loading">No chats found.</p>';
    } catch (err) {
        showToast(err.message);
    }
}

async function openChat(id, number, isHuman) {
    currentConversationId = id;
    el.chatHeader.classList.remove('hidden');
    el.chatUserNumber.textContent = number;
    el.checkHuman.checked = isHuman === 'true' || isHuman === true;

    // Refresh sidebar to show active
    loadConversations(el.searchHistory.value);
    loadMessages(id);
}

async function loadMessages(id) {
    try {
        const { data: messages } = await apiCall(`${API_BASE}/conversations/${id}/messages`, 'GET', null, currentClient.apiKey);
        el.messageContainer.innerHTML = messages.reverse().map(m => `
            <div class="msg ${m.role === 'user' ? 'msg-user' : 'msg-ai'}">
                ${m.content}
                <span class="msg-time">${new Date(m.created_at).toLocaleTimeString()}</span>
            </div>
        `).join('');
        el.messageContainer.scrollTop = el.messageContainer.scrollHeight;
    } catch (err) {
        showToast(err.message);
    }
}

el.searchHistory.oninput = (e) => loadConversations(e.target.value);

el.checkHuman.onchange = async (e) => {
    const active = e.target.checked;
    try {
        const method = active ? 'POST' : 'DELETE';
        await apiCall(`${API_BASE}/conversations/${currentConversationId}/human-takeover`, method, null, currentClient.apiKey);
        showToast(active ? 'Human takeover enabled' : 'AI resumed');
        loadConversations(el.searchHistory.value);
    } catch (err) {
        showToast(err.message);
        e.target.checked = !active;
    }
};

// --- Actions ---
el.formClient.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const payload = {
        name: document.getElementById('client-name').value,
        whatsapp_business_id: document.getElementById('wa-biz-id').value,
        whatsapp_phone_number_id: document.getElementById('wa-phone-id').value,
        access_token: document.getElementById('wa-token').value,
        system_prompt: document.getElementById('system-prompt').value,
    };

    try {
        const res = id
            ? await apiCall(`${ADMIN_API}/clients/${id}`, 'PUT', payload)
            : await apiCall(`${ADMIN_API}/clients`, 'POST', payload);

        if (!id && res.data.apiKey) {
            showKeyModal(res.data.apiKey);
            sessionStorage.setItem(`key_${res.data.id}`, res.data.apiKey);
        }

        closeModals();
        loadClients();
        showToast('Client saved successfully');
    } catch (err) {
        showToast(err.message);
    }
};

el.formKnowledge.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('kn-title').value,
        type_knowledge: document.getElementById('kn-type').value,
        content: document.getElementById('kn-content').value,
    };

    try {
        await apiCall(`${API_BASE}/knowledge`, 'POST', payload, currentClient.apiKey);
        closeModals();
        loadKnowledge();
        showToast('Knowledge added');
    } catch (err) {
        showToast(err.message);
    }
};

window.deleteClient = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
        await apiCall(`${ADMIN_API}/clients/${id}`, 'DELETE');
        loadClients();
        showToast('Client deleted');
    } catch (err) {
        showToast(err.message);
    }
};

window.resetKey = async (id) => {
    if (!confirm('Are you sure? Old API Key will stop working immediately.')) return;
    try {
        const res = await apiCall(`${ADMIN_API}/clients/${id}/reset-api-key`, 'POST');
        showKeyModal(res.data.apiKey);
        sessionStorage.setItem(`key_${id}`, res.data.apiKey);
        showToast('API Key reset successfully');
    } catch (err) {
        showToast(err.message);
    }
};

window.deleteKnowledge = async (id) => {
    if (!confirm('Delete this knowledge?')) return;
    try {
        await apiCall(`${API_BASE}/knowledge/${id}`, 'DELETE', null, currentClient.apiKey);
        loadKnowledge();
        showToast('Knowledge deleted');
    } catch (err) {
        showToast(err.message);
    }
};

window.editClient = async (id) => {
    try {
        const { data: client } = await apiCall(`${ADMIN_API}/clients/${id}`);
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-name').value = client.name;
        document.getElementById('wa-biz-id').value = client.whatsapp_business_id;
        document.getElementById('wa-phone-id').value = client.whatsapp_phone_number_id;
        document.getElementById('wa-token').value = ''; // Don't show encrypted token
        document.getElementById('system-prompt').value = client.system_prompt;

        document.getElementById('modal-client-title').textContent = 'Edit Client';
        el.modalClient.classList.remove('hidden');
    } catch (err) {
        showToast(err.message);
    }
};

// --- UI Helpers ---
function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    setTimeout(() => el.toast.classList.add('hidden'), 3000);
}

function showKeyModal(key) {
    el.newApiKey.textContent = key;
    el.modalKey.classList.remove('hidden');
}

function closeModals() {
    el.modalClient.classList.add('hidden');
    el.modalKnowledge.classList.add('hidden');
    el.modalKey.classList.add('hidden');
    el.formClient.reset();
    el.formKnowledge.reset();
}

document.getElementById('btn-add-client').onclick = () => {
    document.getElementById('client-id').value = '';
    document.getElementById('modal-client-title').textContent = 'Add New Client';
    el.modalClient.classList.remove('hidden');
};

document.getElementById('btn-add-knowledge').onclick = () => el.modalKnowledge.classList.remove('hidden');
document.getElementById('btn-back-clients').onclick = () => {
    el.clientSection.classList.remove('hidden');
    el.knowledgeSection.classList.add('hidden');
};

document.querySelectorAll('.btn-close-modal').forEach(btn => btn.onclick = closeModals);

document.addEventListener('click', e => {
    if (e.target.classList.contains('btn-copy')) {
        const targetId = e.target.getAttribute('data-target');
        const text = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
    }
});

// Init
loadClients();
