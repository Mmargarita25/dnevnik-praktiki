import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, setDoc, getDoc, 
    query, orderBy
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
    loadGeminiKey();
}

// Табы
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
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
        const startDate = new Date(`2000-01-01T${start}`);
        const endDate = new Date(`2000-01-01T${end}`);
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

// Загрузка записей
async function loadLogs() {
    const q = query(collection(db, "users", currentUser.uid, "logs"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    
    totalHours = 0;
    let html = '';
    
    snapshot.forEach(doc => {
        const log = doc.data();
        totalHours += log.hours;
        html += `
            <div class="log-item">
                <div class="log-header">
                    <span>📅 ${log.date}</span>
                    <span class="log-hours">⏱️ ${log.hours} ч.</span>
                </div>
                <div>🕐 ${log.timeStart} - ${log.timeEnd}</div>
                <div class="log-task">${escapeHtml(log.task)}</div>
            </div>
        `;
    });
    
    document.getElementById('logsList').innerHTML = html || '<p style="text-align: center; color: #999;">Нет записей</p>';
    updateStats();
}

// Обновление статистики
function updateStats() {
    document.getElementById('totalHours').innerText = totalHours.toFixed(1);
    const remaining = targetHours - totalHours;
    document.getElementById('remainingHours').innerText = remaining > 0 ? remaining.toFixed(1) : 0;
}

// Контакты
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
    
    snapshot.forEach(doc => {
        const contact = doc.data();
        html += `
            <div class="contact-item">
                <div class="contact-info">
                    <h4>${escapeHtml(contact.name)}</h4>
                    <p>${escapeHtml(contact.role) || '—'}</p>
                    ${contact.phone ? `<p>📞 ${escapeHtml(contact.phone)}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    document.getElementById('contactsList').innerHTML = html || '<p style="text-align: center; color: #999;">Нет контактов</p>';
}

// Профиль
async function loadProfile() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid, "settings", "profile"));
    if (docSnap.exists()) {
        document.getElementById('userFullName').value = docSnap.data().fullName || '';
    }
}

// Настройки
function loadGeminiKey() {
    const key = localStorage.getItem('gemini_api_key');
    if (key) document.getElementById('geminiKey').value = key;
}

document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
    const fullName = document.getElementById('userFullName').value;
    const apiKey = document.getElementById('geminiKey').value.trim();
    
    await setDoc(doc(db, "users", currentUser.uid, "settings", "profile"), {
        fullName: fullName
    });
    
    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
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
            fileInfo.innerHTML = `✅ Загружен: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        } 
        else if (file.name.endsWith('.docx')) {
            fileInfo.innerHTML = `⏳ Чтение файла ${file.name}...`;
            fileInfo.style.display = 'block';
            
            const text = await readDocxFile(file);
            exampleText.value = text;
            
            fileInfo.innerHTML = `✅ Загружен DOCX: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        } 
        else {
            alert('Поддерживаются только файлы .txt и .docx');
            fileInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка чтения файла:', error);
        fileInfo.innerHTML = `❌ Ошибка: не удалось прочитать файл`;
        alert('Не удалось прочитать файл. Попробуйте скопировать текст вручную.');
    }
    
    document.getElementById('fileLabel').innerHTML = `📄 ${file.name}`;
});

// Генерация отчета - ИСПРАВЛЕННАЯ ВЕРСИЯ
document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert('Введите API ключ Gemini в настройках');
        return;
    }
    
    const exampleText = document.getElementById('exampleText').value;
    const practiceTask = document.getElementById('practiceTask').value;
    const userName = document.getElementById('userFullName').value || currentUser.email;
    
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
        diaryText += `Дата: ${log.date}, Время: ${log.timeStart}-${log.timeEnd} (${log.hours} ч.)\nВыполнено: ${log.task}\n\n`;
    });
    
    const prompt = `Ты пишешь официальный отчет по производственной практике для студента.
    
    Информация о студенте:
    ФИО: ${userName}
    Задание на практику: ${practiceTask}
    Общее количество часов: ${totalHoursSum}
    
    Ежедневные записи:
    ${diaryText}
    
    ВАЖНО: Сгенерируй отчет по практике, строго следуя структуре и стилю форматирования из ПРИМЕРА ниже.
    Если пример не предоставлен, используй стандартную академическую структуру.
    
    ПРИМЕР (скопируй стиль оформления, заголовки, отступы, шрифты):
    ${exampleText || 'Используй стандартный академический отчет с заголовками H1 для названия, H2 для разделов, абзацами P с красной строкой'}
    
    Требования к формату:
    - Используй HTML теги: <h1>, <h2>, <p>, <ul>, <li>, <b>, <table> где нужно
    - Не используй маркдаун 
    - Добавь шапку с датой и местом практики
    - Сделай таблицу с графиком работы если нужно
    - Добавь раздел "Характеристика" или "Отзыв руководителя" (шаблонно)
    - Выведи ТОЛЬКО HTML код, без лишних комментариев`;
    
    document.getElementById('reportResult').style.display = 'block';
    document.getElementById('reportContent').innerHTML = '<p style="text-align:center;">⏳ Генерация отчета... Это может занять 10-20 секунд</p>';
    
    try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                }
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        let htmlContent = result.candidates[0].content.parts[0].text;
        // Очищаем от маркдауна
        htmlContent = htmlContent.replace(/```html/g, '');
        htmlContent = htmlContent.replace(/```/g, '');
        htmlContent = htmlContent.replace(/^\s*```\s*$/gm, '');
        
        document.getElementById('reportContent').innerHTML = htmlContent;
        
    } catch (error) {
        console.error('Ошибка Gemini:', error);
        document.getElementById('reportContent').innerHTML = `<p style="color:red;">❌ Ошибка генерации: ${error.message}<br><br>Проверьте API ключ и попробуйте снова.</p>`;
    }
});

// Скачать PDF
document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
    const element = document.getElementById('reportContent');
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Отчет_по_практике_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

// Функция для сохранения в Word
function saveAsDocx(content, filename) {
    // Оборачиваем контент в полноценный HTML документ для Word
    const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Отчет по практике</title>
            <style>
                body {
                    font-family: 'Times New Roman', Times, serif;
                    margin: 2.5cm;
                    font-size: 14pt;
                    line-height: 1.5;
                }
                h1 {
                    font-size: 24pt;
                    text-align: center;
                    margin-bottom: 20pt;
                }
                h2 {
                    font-size: 18pt;
                    margin-top: 20pt;
                    margin-bottom: 10pt;
                }
                h3 {
                    font-size: 16pt;
                    margin-top: 15pt;
                }
                p {
                    margin-bottom: 10pt;
                    text-indent: 1.25cm;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 15pt 0;
                }
                th, td {
                    border: 1px solid black;
                    padding: 8pt;
                    text-align: left;
                }
                ul, ol {
                    margin: 10pt 0;
                    padding-left: 20pt;
                }
                li {
                    margin-bottom: 5pt;
                }
                .signature {
                    margin-top: 40pt;
                    display: flex;
                    justify-content: space-between;
                }
                .date-place {
                    text-align: right;
                    margin-bottom: 20pt;
                }
            </style>
        </head>
        <body>
            <div class="date-place">
                <p>г. Минск<br>${new Date().toLocaleDateString('ru-RU')}</p>
            </div>
            ${content}
            <div class="signature">
                <div>Руководитель практики: ______________</div>
                <div>Студент: ______________</div>
            </div>
        </body>
        </html>
    `;
    
    // Создаем Blob с MIME типом для Word
    const blob = new Blob([fullHtml], { type: 'application/msword' });
    
    // Скачиваем файл
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
    const filename = `Отчет_по_практике_${new Date().toISOString().slice(0, 10)}.doc`;
    saveAsDocx(content, filename);
});