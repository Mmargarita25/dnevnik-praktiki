import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, setDoc, getDoc, 
    query, orderBy, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let totalHours = 0;
let targetHours = 0;

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    currentUser = user;
    loadAllData();
});

// Загрузка всех данных
async function loadAllData() {
    await loadGoal();
    await loadLogs();
    await loadContacts();
    await loadProfile();
    await loadPracticePlace();
    loadApiKey();
}

// Табы
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId + '-tab').classList.add('active');
    });
});

// Выход
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut(auth);
});

// Расчет часов за день
function calculateDailyHours() {
    const start = document.getElementById('timeStart').value;
    const end = document.getElementById('timeEnd').value;
    if (start && end) {
        const startDate = new Date('2000-01-01T' + start);
        const endDate = new Date('2000-01-01T' + end);
        let diff = (endDate - startDate) / (1000 * 60 * 60);
        if (diff < 0) diff += 24;
        document.getElementById('dailyHours').innerText = diff.toFixed(1);
        return diff;
    }
    return 0;
}

document.getElementById('timeStart')?.addEventListener('change', calculateDailyHours);
document.getElementById('timeEnd')?.addEventListener('change', calculateDailyHours);

// Сохранение цели
document.getElementById('saveGoalBtn')?.addEventListener('click', async () => {
    const task = document.getElementById('practiceTask').value;
    const hours = parseInt(document.getElementById('targetHours').value) || 0;
    
    await setDoc(doc(db, "users", currentUser.uid, "settings", "goal"), {
        task: task,
        targetHours: hours
    });
    
    targetHours = hours;
    updateStats();
    alert('Цель сохранена!');
});

// Загрузка цели
async function loadGoal() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid, "settings", "goal"));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('practiceTask').value = data.task || '';
        document.getElementById('targetHours').value = data.targetHours || 0;
        targetHours = data.targetHours || 0;
        updateStats();
    }
}

// Добавление записи
document.getElementById('addLogBtn')?.addEventListener('click', async () => {
    const date = document.getElementById('logDate').value;
    const timeStart = document.getElementById('timeStart').value;
    const timeEnd = document.getElementById('timeEnd').value;
    const hours = parseFloat(document.getElementById('dailyHours').innerText);
    const task = document.getElementById('logTask').value;
    
    if (!date || !timeStart || !timeEnd || !task) {
        alert('Заполните все поля');
        return;
    }
    
    if (hours <= 0) {
        alert('Время указано неверно');
        return;
    }
    
    await addDoc(collection(db, "users", currentUser.uid, "logs"), {
        date: date,
        timeStart: timeStart,
        timeEnd: timeEnd,
        hours: hours,
        task: task,
        createdAt: new Date().toISOString()
    });
    
    document.getElementById('logDate').value = '';
    document.getElementById('timeStart').value = '';
    document.getElementById('timeEnd').value = '';
    document.getElementById('logTask').value = '';
    document.getElementById('dailyHours').innerText = '0';
    
    await loadLogs();
    alert('Запись добавлена!');
});

// Редактирование записи
async function editLog(logId, oldData) {
    const newDate = prompt('Введите дату (ГГГГ-ММ-ДД):', oldData.date);
    const newTimeStart = prompt('Время начала (ЧЧ:ММ):', oldData.timeStart);
    const newTimeEnd = prompt('Время окончания (ЧЧ:ММ):', oldData.timeEnd);
    const newTask = prompt('Что сделано:', oldData.task);
    
    if (newDate && newTimeStart && newTimeEnd && newTask) {
        const startDate = new Date('2000-01-01T' + newTimeStart);
        const endDate = new Date('2000-01-01T' + newTimeEnd);
        let newHours = (endDate - startDate) / (1000 * 60 * 60);
        if (newHours < 0) newHours += 24;
        
        await updateDoc(doc(db, "users", currentUser.uid, "logs", logId), {
            date: newDate,
            timeStart: newTimeStart,
            timeEnd: newTimeEnd,
            hours: newHours,
            task: newTask
        });
        await loadLogs();
        alert('Запись обновлена!');
    }
}

// Удаление записи
async function deleteLog(logId) {
    if (confirm('Удалить эту запись?')) {
        await deleteDoc(doc(db, "users", currentUser.uid, "logs", logId));
        await loadLogs();
        alert('Запись удалена!');
    }
}

// Загрузка записей
async function loadLogs() {
    const q = query(collection(db, "users", currentUser.uid, "logs"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    
    totalHours = 0;
    let html = '';
    
    snapshot.forEach(docSnap => {
        const log = docSnap.data();
        const logId = docSnap.id;
        totalHours += log.hours;
        html += `
            <div class="log-item">
                <div class="log-header">
                    <span>📅 ${log.date}</span>
                    <span class="log-hours">⏱️ ${log.hours} ч.</span>
                </div>
                <div>🕐 ${log.timeStart} - ${log.timeEnd}</div>
                <div class="log-task">${escapeHtml(log.task)}</div>
                <div class="log-actions">
                    <button class="btn-small btn-edit" onclick="window.editLog('${logId}', ${JSON.stringify(log).replace(/"/g, '&quot;')})">✏️ Редактировать</button>
                    <button class="btn-small btn-delete" onclick="window.deleteLog('${logId}')">🗑️ Удалить</button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('logsList').innerHTML = html || '<p style="text-align: center; color: #999;">Нет записей</p>';
    updateStats();
}

window.editLog = editLog;
window.deleteLog = deleteLog;

// Обновление статистики
function updateStats() {
    document.getElementById('totalHours').innerText = totalHours.toFixed(1);
    const remaining = targetHours - totalHours;
    document.getElementById('remainingHours').innerText = remaining > 0 ? remaining.toFixed(1) : 0;
}

// Редактирование контакта
async function editContact(contactId, oldData) {
    const newName = prompt('Введите ФИО:', oldData.name);
    const newRole = prompt('Введите должность:', oldData.role);
    const newPhone = prompt('Введите телефон:', oldData.phone);
    
    if (newName) {
        await updateDoc(doc(db, "users", currentUser.uid, "contacts", contactId), {
            name: newName,
            role: newRole || '',
            phone: newPhone || ''
        });
        await loadContacts();
        alert('Контакт обновлен!');
    }
}

// Удаление контакта
async function deleteContact(contactId) {
    if (confirm('Удалить этот контакт?')) {
        await deleteDoc(doc(db, "users", currentUser.uid, "contacts", contactId));
        await loadContacts();
        alert('Контакт удален!');
    }
}

// Добавление контакта
document.getElementById('addContactBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('contactName').value;
    const role = document.getElementById('contactRole').value;
    const phone = document.getElementById('contactPhone').value;
    
    if (!name) {
        alert('Введите ФИО');
        return;
    }
    
    await addDoc(collection(db, "users", currentUser.uid, "contacts"), {
        name: name,
        role: role,
        phone: phone,
        createdAt: new Date().toISOString()
    });
    
    document.getElementById('contactName').value = '';
    document.getElementById('contactRole').value = '';
    document.getElementById('contactPhone').value = '';
    
    await loadContacts();
    alert('Контакт добавлен!');
});

async function loadContacts() {
    const snapshot = await getDocs(collection(db, "users", currentUser.uid, "contacts"));
    let html = '';
    
    snapshot.forEach(docSnap => {
        const contact = docSnap.data();
        const contactId = docSnap.id;
        html += `
            <div class="contact-item">
                <div class="contact-info">
                    <h4>${escapeHtml(contact.name)}</h4>
                    <p>${escapeHtml(contact.role) || '—'}</p>
                    ${contact.phone ? '<p>📞 ' + escapeHtml(contact.phone) + '</p>' : ''}
                </div>
                <div class="contact-actions">
                    <button class="btn-small btn-edit" onclick="window.editContact('${contactId}', ${JSON.stringify(contact).replace(/"/g, '&quot;')})">✏️</button>
                    <button class="btn-small btn-delete" onclick="window.deleteContact('${contactId}')">🗑️</button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('contactsList').innerHTML = html || '<p style="text-align: center; color: #999;">Нет контактов</p>';
}

window.editContact = editContact;
window.deleteContact = deleteContact;

// Профиль
async function loadProfile() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid, "settings", "profile"));
    if (docSnap.exists()) {
        document.getElementById('userFullName').value = docSnap.data().fullName || '';
    }
}

// Место практики
async function loadPracticePlace() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid, "settings", "practice"));
    if (docSnap.exists()) {
        document.getElementById('practicePlace').value = docSnap.data().place || '';
    }
}

async function savePracticePlace(place) {
    await setDoc(doc(db, "users", currentUser.uid, "settings", "practice"), {
        place: place
    });
}

// Настройки API ключа
function loadApiKey() {
    const key = localStorage.getItem('deepseek_api_key');
    if (key) document.getElementById('geminiKey').value = key;
}

document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
    const fullName = document.getElementById('userFullName').value;
    const apiKey = document.getElementById('geminiKey').value.trim();
    const practicePlace = document.getElementById('practicePlace').value;
    
    await setDoc(doc(db, "users", currentUser.uid, "settings", "profile"), {
        fullName: fullName
    });
    
    await savePracticePlace(practicePlace);
    
    if (apiKey) {
        localStorage.setItem('deepseek_api_key', apiKey);
    }
    
    alert('Настройки сохранены!');
});

// Функция для экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Функция для чтения DOCX файла
async function readDocxFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                resolve(result.value);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Загрузка файла примера
document.getElementById('exampleFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fileInfo = document.getElementById('fileInfo');
    const exampleText = document.getElementById('exampleText');
    
    try {
        if (file.name.endsWith('.txt')) {
            const text = await file.text();
            exampleText.value = text;
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = '✅ Загружен: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        } 
        else if (file.name.endsWith('.docx')) {
            fileInfo.innerHTML = '⏳ Чтение файла ' + file.name + '...';
            fileInfo.style.display = 'block';
            
            const text = await readDocxFile(file);
            exampleText.value = text;
            
            fileInfo.innerHTML = '✅ Загружен DOCX: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        } 
        else {
            alert('Поддерживаются только файлы .txt и .docx');
            fileInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
        fileInfo.innerHTML = '❌ Ошибка: не удалось прочитать файл';
        alert('Не удалось прочитать файл. Попробуйте скопировать текст вручную.');
    }
    
    document.getElementById('fileLabel').innerHTML = '📄 ' + file.name;
});

// Генерация плана по дням
document.getElementById('generatePlanBtn')?.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('deepseek_api_key');
    if (!apiKey) {
        alert('Введите API ключ DeepSeek в настройках');
        return;
    }
    
    const practiceTask = document.getElementById('practiceTask').value;
    const targetHoursTotal = parseInt(document.getElementById('targetHours').value) || 0;
    const startDate = document.getElementById('logDate').value || new Date().toISOString().slice(0, 10);
    
    if (!practiceTask || targetHoursTotal === 0) {
        alert('Сначала заполните задание на практику и количество часов в разделе Дневник');
        return;
    }
    
    const systemPrompt = "Ты - помощник по планированию практики. Твоя задача - создать подробный план выполнения задания по дням.";
    
    const userPrompt = "Задание на практику: " + practiceTask + "\n";
    userPrompt += "Общее количество часов: " + targetHoursTotal + "\n";
    userPrompt += "Дата начала: " + startDate + "\n\n";
    userPrompt += "Составь план выполнения задания, разбитый по дням. Укажи для каждого дня:\n";
    userPrompt += "- День (номер или дата)\n";
    userPrompt += "- Количество часов\n";
    userPrompt += "- Что нужно сделать\n\n";
    userPrompt += "План должен быть реалистичным и учитывать общее количество часов.\n";
    userPrompt += "Оформи план в виде HTML с тегами ul, li, strong. Выведи только HTML код.";
    
    document.getElementById('planResult').style.display = 'block';
    document.getElementById('planContent').innerHTML = '<p>⏳ Генерация плана...</p>';
    
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 2048
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        let planContent = result.choices[0].message.content;
        planContent = planContent.replace(/```html/g, '');
        planContent = planContent.replace(/```/g, '');
        
        document.getElementById('planContent').innerHTML = planContent;
        
    } catch (error) {
        document.getElementById('planContent').innerHTML = '<p style="color:red;">❌ Ошибка: ' + error.message + '</p>';
    }
});

// Копирование плана
document.getElementById('copyPlanBtn')?.addEventListener('click', () => {
    const planText = document.getElementById('planContent').innerText;
    navigator.clipboard.writeText(planText);
    alert('План скопирован в буфер обмена!');
});

// Генерация отчета через DeepSeek API
document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('deepseek_api_key');
    if (!apiKey) {
        alert('Введите API ключ DeepSeek в настройках');
        return;
    }
    
    const exampleText = document.getElementById('exampleText').value;
    const practiceTask = document.getElementById('practiceTask').value;
    const userName = document.getElementById('userFullName').value || currentUser.email;
    const practicePlace = document.getElementById('practicePlace').value || 'место практики';
    
    // Получаем все записи
    const q = query(collection(db, "users", currentUser.uid, "logs"), orderBy("date", "asc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        alert('Нет записей для генерации отчета. Добавьте хотя бы одну запись в дневник.');
        return;
    }
    
    let diaryText = '';
    let totalHoursSum = 0;
    snapshot.forEach(doc => {
        const log = doc.data();
        totalHoursSum += log.hours;
        diaryText += 'Дата: ' + log.date + ', Время: ' + log.timeStart + '-' + log.timeEnd + ' (' + log.hours + ' ч.)\nВыполнено: ' + log.task + '\n\n';
    });
    
    const systemPrompt = "Ты - профессиональный помощник по написанию отчетов по практике. Отвечай только на русском языке.";
    
    let userPrompt = "Создай официальный отчет по производственной практике.\n\n";
    userPrompt += "Информация о студенте:\n";
    userPrompt += "ФИО: " + userName + "\n";
    userPrompt += "Место практики: " + practicePlace + "\n";
    userPrompt += "Задание на практику: " + practiceTask + "\n";
    userPrompt += "Общее количество часов: " + totalHoursSum + "\n\n";
    userPrompt += "Ежедневные записи студента:\n" + diaryText + "\n";
    
    if (exampleText) {
        userPrompt += "Ниже представлен пример отчета. Следуй его структуре и стилю оформления:\n\n";
        userPrompt += "ПРИМЕР:\n" + exampleText + "\n\n";
    }
    
    userPrompt += "Требования к отчету:\n";
    userPrompt += "1. Используй официально-деловой стиль\n";
    userPrompt += "2. Укажи место практики: " + practicePlace + "\n";
    userPrompt += "3. Отчет должен содержать:\n";
    userPrompt += "   - Шапку с местом и датой\n";
    userPrompt += "   - Введение (цели и задачи практики)\n";
    userPrompt += "   - Основную часть (описание выполненной работы с группировкой по дням)\n";
    userPrompt += "   - Заключение (выводы, приобретенные навыки)\n";
    userPrompt += "   - Место для подписей руководителя и студента\n";
    userPrompt += "4. Оформи отчет в HTML формате с тегами: h1, h2, p, ul, li, table.\n";
    userPrompt += "5. Не используй маркдаун. Выведи только чистый HTML код.";
    
    document.getElementById('reportResult').style.display = 'block';
    document.getElementById('reportContent').innerHTML = '<p style="text-align:center;">⏳ Генерация отчета через DeepSeek... Это может занять 10-20 секунд</p>';
    
    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 4096
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        let htmlContent = result.choices[0].message.content;
        htmlContent = htmlContent.replace(/```html/g, '');
        htmlContent = htmlContent.replace(/```/g, '');
        htmlContent = htmlContent.replace(/^\s*```\s*$/gm, '');
        
        document.getElementById('reportContent').innerHTML = htmlContent;
        
    } catch (error) {
        console.error('Ошибка DeepSeek:', error);
        document.getElementById('reportContent').innerHTML = '<p style="color:red;">❌ Ошибка генерации: ' + error.message + '</p>';
    }
});

// Скачать PDF
document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
    const element = document.getElementById('reportContent');
    const opt = {
        margin: [10, 10, 10, 10],
        filename: 'Отчет_по_практике_' + new Date().toISOString().slice(0, 10) + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

// Функция для сохранения в Word
function saveAsWord(content, filename) {
    const practicePlace = document.getElementById('practicePlace').value || 'место практики';
    const fullHtml = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>Отчет по практике</title>\n<style>\nbody {\nfont-family: "Times New Roman", Times, serif;\nmargin: 2.5cm;\nfont-size: 14pt;\nline-height: 1.5;\n}\nh1 {\nfont-size: 24pt;\ntext-align: center;\nmargin-bottom: 20pt;\n}\nh2 {\nfont-size: 18pt;\nmargin-top: 20pt;\nmargin-bottom: 10pt;\n}\np {\nmargin-bottom: 10pt;\ntext-indent: 1.25cm;\n}\ntable {\nborder-collapse: collapse;\nwidth: 100%;\nmargin: 15pt 0;\n}\nth, td {\nborder: 1px solid black;\npadding: 8pt;\ntext-align: left;\n}\n.signature {\nmargin-top: 40pt;\ndisplay: flex;\njustify-content: space-between;\n}\n</style>\n</head>\n<body>\n<div style="text-align: right; margin-bottom: 20pt;">\n<p>' + practicePlace + '<br>' + new Date().toLocaleDateString('ru-RU') + '</p>\n</div>\n' + content + '\n<div class="signature">\n<div>Руководитель практики: ______________</div>\n<div>Студент: ______________</div>\n</div>\n</body>\n</html>';
    
    const blob = new Blob([fullHtml], { type: 'application/msword' });
    
    if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Скачать Word
document.getElementById('downloadWordBtn')?.addEventListener('click', () => {
    const content = document.getElementById('reportContent').innerHTML;
    const filename = 'Отчет_по_практике_' + new Date().toISOString().slice(0, 10) + '.doc';
    saveAsWord(content, filename);
});