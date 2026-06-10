import { auth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authBtn = document.getElementById('authBtn');
const authTitle = document.getElementById('authTitle');
const toggleAuth = document.getElementById('toggleAuth');

let isLoginMode = true;

// Переключение между Входом и Регистрацией
toggleAuth.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.innerText = "Войти в аккаунт";
        authBtn.innerText = "Войти";
        toggleAuth.innerText = "Нет аккаунта? Зарегистрироваться";
    } else {
        authTitle.innerText = "Регистрация";
        authBtn.innerText = "Создать аккаунт";
        toggleAuth.innerText = "Уже есть аккаунт? Войти";
    }
});

// Обработка клика по кнопке
authBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Заполните все поля");
        return;
    }

    try {
        if (isLoginMode) {
            // Логика входа
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'index.html';
        } else {
            // Логика регистрации
            await createUserWithEmailAndPassword(auth, email, password);
            alert("Регистрация успешна!");
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        alert("Ошибка: " + error.message);
    }
});

// Проверка: если пользователь уже вошел, перенаправляем на главную
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.endsWith('auth.html')) {
        window.location.href = 'index.html';
    }
});