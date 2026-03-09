const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
require('dotenv').config();

// Токен бота из .env файла
const token = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Создание экземпляра бота
const bot = new TelegramBot(token, { polling: true });

// Состояния пользователей
const userStates = {};

// Тексты на разных языках
const texts = {
    ru: {
        welcome: '👋 Добро пожаловать! Выберите язык:',
        languageSelected: '✅ Вы выбрали русский язык',
        subscribe: `👋 Привет! Для использования бота необходимо подписаться на наш канал {channel}`,
        subscribeButton: 'Подписаться на канал',
        checkButton: 'Проверить подписку',
        thanksSubscribe: '✅ Спасибо за подписку! Начинаем регистрацию.',
        notSubscribed: '❌ Вы еще не подписались. Пожалуйста, подпишитесь на канал.',
        fullname: 'Введите ваше ФИО:',
        age: 'Введите ваш возраст:',
        ageError: 'Пожалуйста, введите корректный возраст (число от 1 до 100):',
        school: 'Введите номер вашей школы:',
        class: 'Введите ваш класс (например: 10А):',
        region: 'Введите ваш регион:',
        poem: 'Отправьте стихотворение:',
        completed: '✅ Регистрация завершена!\n\n📋 Ваши данные:\n👤 ФИО: {fullname}\n🎂 Возраст: {age}\n🏫 Школа: {school}\n📚 Класс: {class}\n🌍 Регион: {region}\n📝 Стихотворение: {poem}'
    },
    uz: {
        welcome: '👋 Xush kelibsiz! Tilni tanlang:',
        languageSelected: '✅ Siz oʻzbek tilini tanladingiz',
        subscribe: `👋 Assalomu alaykum! Botdan foydalanish uchun kanalimizga obuna bo'lishingiz kerak {channel}`,
        subscribeButton: 'Kanalga obuna bo\'lish',
        checkButton: 'Obunani tekshirish',
        thanksSubscribe: '✅ Obuna uchun rahmat! Ro\'yxatdan o\'tishni boshlaymiz.',
        notSubscribed: '❌ Siz hali obuna bo\'lmagansiz. Iltimos, kanalga obuna bo\'ling.',
        fullname: 'F.I.O. ni kiriting:',
        age: 'Yoshingizni kiriting:',
        ageError: 'Iltimos, to\'g\'ri yoshni kiriting (1 dan 100 gacha):',
        school: 'Maktab raqamini kiriting:',
        class: 'Sinfingizni kiriting (masalan: 10А):',
        region: 'Viloyatingizni kiriting:',
        poem: 'She\'r matnini yuboring:',
        completed: '✅ Ro\'yxatdan o\'tish tugadi!\n\n📋 Sizning ma\'lumotlaringiz:\n👤 F.I.O.: {fullname}\n🎂 Yosh: {age}\n🏫 Maktab: {school}\n📚 Sinf: {class}\n🌍 Viloyat: {region}\n📝 She\'r: {poem}'
    }
};

function getText(lang, key, replacements = {}) {
    let text = texts[lang]?.[key] || texts.ru[key];
    for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(`{${placeholder}}`, value);
    }
    return text;
}

// Функция проверки подписки
async function checkSubscription(userId) {
    try {
        const chatMember = await bot.getChatMember(CHANNEL_ID, userId);
        console.log('Статус подписки:', chatMember.status);
        return ['member', 'administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        console.error('Ошибка проверки подписки:', error.message);
        return false;
    }
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await db.createUser(userId);
    
    if (userStates[userId]) {
        delete userStates[userId];
    }
    
    // Показываем выбор языка
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
                { text: '🇺🇿 O\'zbek', callback_data: 'lang_uz' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, 'Выберите язык / Tilni tanlang:', { reply_markup: keyboard });
});

// Обработка callback кнопок
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data.startsWith('lang_')) {
        const lang = data.replace('lang_', '');
        await db.updateUserData(userId, 'language', lang);
        await bot.sendMessage(chatId, getText(lang, 'languageSelected'));
        
        // ПРОВЕРЯЕМ ПОДПИСКУ СРАЗУ ПОСЛЕ ВЫБОРА ЯЗЫКА
        await checkSubAndRegister(chatId, userId, lang);
    }
    else if (data === 'check_subscription') {
        const userData = await db.getUserData(userId);
        const lang = userData?.language || 'ru';
        
        // ПРОВЕРЯЕМ ПОДПИСКУ ПРИ НАЖАТИИ КНОПКИ
        await checkSubAndRegister(chatId, userId, lang);
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
});

// НОВАЯ ФУНКЦИЯ: проверяет подписку и показывает нужный экран
async function checkSubAndRegister(chatId, userId, lang) {
    const isSubscribed = await checkSubscription(userId);
    
    if (isSubscribed) {
        // Если подписан - начинаем регистрацию
        await bot.sendMessage(chatId, getText(lang, 'thanksSubscribe'));
        await startRegistration(chatId, userId, lang);
    } else {
        // Если не подписан - показываем кнопки подписки
        const keyboard = {
            inline_keyboard: [
                [{ text: getText(lang, 'subscribeButton'), url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }],
                [{ text: getText(lang, 'checkButton'), callback_data: 'check_subscription' }]
            ]
        };
        
        await bot.sendMessage(
            chatId,
            getText(lang, 'subscribe', { channel: CHANNEL_ID }),
            { reply_markup: keyboard }
        );
    }
}

// Функция начала регистрации
async function startRegistration(chatId, userId, lang) {
    userStates[userId] = {
        step: 'awaiting_fullname',
        lang: lang
    };
    await bot.sendMessage(chatId, getText(lang, 'fullname'));
}

// Обработка сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (text.startsWith('/')) return;
    if (!userStates[userId]) return;
    
    const state = userStates[userId];
    const lang = state.lang;
    
    switch (state.step) {
        case 'awaiting_fullname':
            await db.updateUserData(userId, 'full_name', text);
            state.step = 'awaiting_age';
            await bot.sendMessage(chatId, getText(lang, 'age'));
            break;
            
        case 'awaiting_age':
            if (isNaN(text) || parseInt(text) < 1 || parseInt(text) > 100) {
                await bot.sendMessage(chatId, getText(lang, 'ageError'));
                return;
            }
            await db.updateUserData(userId, 'age', parseInt(text));
            state.step = 'awaiting_school';
            await bot.sendMessage(chatId, getText(lang, 'school'));
            break;
            
        case 'awaiting_school':
            await db.updateUserData(userId, 'school', text);
            state.step = 'awaiting_class';
            await bot.sendMessage(chatId, getText(lang, 'class'));
            break;
            
        case 'awaiting_class':
            await db.updateUserData(userId, 'class', text);
            state.step = 'awaiting_region';
            await bot.sendMessage(chatId, getText(lang, 'region'));
            break;
            
        case 'awaiting_region':
            await db.updateUserData(userId, 'region', text);
            state.step = 'awaiting_poem';
            await bot.sendMessage(chatId, getText(lang, 'poem'));
            break;
            
        case 'awaiting_poem':
            await db.updateUserData(userId, 'poem', text);
            await db.completeRegistration(userId);
            
            const completedUserData = await db.getUserData(userId);
            
            const summary = getText(lang, 'completed', {
                fullname: completedUserData.full_name,
                age: completedUserData.age,
                school: completedUserData.school,
                class: completedUserData.class,
                region: completedUserData.region,
                poem: completedUserData.poem.substring(0, 100) + (completedUserData.poem.length > 100 ? '...' : '')
            });
            
            await bot.sendMessage(chatId, summary);
            console.log('Данные пользователя сохранены в БД:', completedUserData);
            
            delete userStates[userId];
            break;
    }
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error);
});

console.log('Бот запущен...');