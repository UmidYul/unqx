# UNQX App — Полный UI/UX аудит и визуальный polish

Ты senior UI/UX разработчик с насмотренностью в уровне
Stripe, Linear, Vercel, Raycast. Проходишь по каждому
экрану приложения и делаешь его красивым, плавным
и запоминающимся. Никаких полумер — каждый пиксель важен.

---

## Принципы которым следуешь

**Spacing:** Единая система отступов — 4, 8, 12, 16, 20, 24, 32, 48.
Никаких произвольных чисел. Слипшиеся элементы — первый враг.

**Typography:** Иерархия — заголовок, подзаголовок, тело, caption.
Каждый уровень отличается размером И весом И цветом.

**Анимации:** Каждое действие имеет отклик. Появление, нажатие,
успех, ошибка — всё анимировано. Длительность 150-350ms.
Используй react-native-reanimated везде где это возможно.

**Иконки:** Только Lucide React Native. strokeWidth 1.5 везде.
Размеры: 16 (caption), 18 (body), 20 (nav), 24 (hero).

**Уникальность:** UNQX — это про технологии и статус.
Эстетика: тёмная элегантность, минимализм, точность.
Референсы: Linear app, Vercel dashboard, Apple Wallet.

---

## Библиотеки для установки

```bash
npx expo install react-native-reanimated
npx expo install react-native-gesture-handler
npx expo install expo-blur
npx expo install expo-linear-gradient
npx expo install react-native-svg
npm install react-native-qrcode-svg --legacy-peer-deps
```

---

## ФИРМЕННЫЙ QR-КОД — сделать первым

Это визитная карточка продукта. Должен быть уникальным.

### Что сделать:
Заменить стандартный QR на фирменный через react-native-qrcode-svg.

```typescript
// components/ui/UnqxQRCode.tsx

import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';
import logo from '../../assets/logo.png'; // логотип UNQX

export function UnqxQRCode({ slug, size = 200 }: { slug: string; size?: number }) {
  return (
    <View style={{
      padding: 16,
      backgroundColor: '#fff',
      borderRadius: 20,
      // Тонкая тень для глубины
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    }}>
      <QRCode
        value={`https://unqx.uz/${slug}`}
        size={size}
        color="#0a0a0a"
        backgroundColor="#ffffff"
        // Логотип UNQX в центре QR
        logo={logo}
        logoSize={size * 0.18}
        logoBackgroundColor="#ffffff"
        logoMargin={4}
        logoBorderRadius={8}
        // Скруглённые точки — фирменный стиль
        enableLinearGradient
        linearGradient={['#000000', '#333333']}
        quietZone={8}
      />
    </View>
  );
}
```

Дополнительно под QR добавить:
- Слаг крупным моноширинным шрифтом с буллет-разделителем: ALI · 001
- Текст "unqx.uz" мелко серым
- Анимация появления QR: FadeIn + scale от 0.8 до 1

---

## СИСТЕМА АНИМАЦИЙ — установить глобально

Создай utils/animations.ts с готовыми пресетами:

```typescript
import { withTiming, withSpring, withSequence,
         withDelay, Easing } from 'react-native-reanimated';

export const anim = {
  // Появление элемента
  fadeIn: (delay = 0) => withDelay(delay,
    withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })),

  // Появление снизу
  slideUp: (delay = 0) => withDelay(delay,
    withSpring(0, { damping: 20, stiffness: 200 })),

  // Нажатие кнопки
  press: withSpring(0.96, { damping: 15, stiffness: 400 }),
  release: withSpring(1, { damping: 15, stiffness: 400 }),

  // Успех (pop эффект)
  success: withSequence(
    withSpring(1.12, { damping: 10, stiffness: 400 }),
    withSpring(1,    { damping: 15, stiffness: 300 }),
  ),

  // Ошибка (shake)
  shake: withSequence(
    withTiming(-8,  { duration: 60 }),
    withTiming( 8,  { duration: 60 }),
    withTiming(-6,  { duration: 60 }),
    withTiming( 6,  { duration: 60 }),
    withTiming( 0,  { duration: 60 }),
  ),

  // Пульс (для NFC колец)
  pulse: withSequence(
    withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
    withTiming(1,    { duration: 800, easing: Easing.inOut(Easing.ease) }),
  ),
};
```

---

## КОМПОНЕНТ КНОПКИ — заменить все кнопки

Создай components/ui/Button.tsx который используется везде:

```typescript
// Варианты: primary (чёрный), secondary (серый), ghost (прозрачный), danger (красный)
// Размеры: sm, md, lg
// Состояния: default, loading, disabled, success

// При нажатии — scale 0.96 через Reanimated
// При loading — ActivityIndicator плавно появляется
// При success — кратковременный зелёный цвет + checkmark
// Все переходы анимированы через withTiming
```

---

## СТРАНИЦА 1 — Home (Главная)

### Проблемы которые нужно найти и исправить:
- Слипшиеся карточки без достаточного gap
- Hero карточка без глубины и характера
- Список последних тапов — скучные строки без визуального веса
- Быстрые действия — иконки и текст на одном уровне восприятия

### Что улучшить:

**Hero карточка — сделать флагманской:**
- LinearGradient фон: от #0a0a0a до #1a1a1a (тёмная) или от #000 до #111
- Имя пользователя — Playfair Display, 26px, белый
- Слаг — моноширинный, letter-spacing 4, с разделителем точкой: ALI · 001
- Бейдж тарифа — стеклянный эффект через expo-blur (BlurView)
- Правый угол — фоновая иконка Wifi 120px, opacity 0.04, белая
- Анимация появления карточки: FadeIn + translateY(20) при mount

**Статистика (2 карточки):**
- Добавить тонкую разноцветную полоску сверху карточки (2px)
  Сегодня — зелёная, Всего — акцентная
- Число тапов — Playfair Display, 36px
- Стрелка роста — анимированная: TrendingUp иконка с цветом

**Последние тапы — сделать живыми:**
- Аватар с градиентным фоном (генерировать цвет из первой буквы имени)
- Имя жирное, слаг серый под ним
- Справа — время И источник (NFC/QR/Прямая) маленьким пиллом
- При появлении списка — staggered анимация (каждый элемент с задержкой +50ms)
- Swipe to action на каждом тапе (react-native-gesture-handler):
  свайп влево → кнопка "Сохранить контакт"

**Быстрые действия:**
- Иконки в квадратных контейнерах с закруглёнными углами
- Hover/press эффект — лёгкое осветление фона
- Текст кнопки и иконка — выровнены по левому краю

---

## СТРАНИЦА 2 — NFC

### Что улучшить:

**Область сканирования — сделать премиальной:**
- Три концентрических кольца с анимацией пульсации
  (не CSS, а Reanimated withRepeat + withTiming)
- Внешнее кольцо — самое прозрачное, самое медленное (3s)
- Среднее — среднее (2s)
- Внутреннее — самое яркое, быстрое (1.5s)
- В центре — иконка Wifi 32px, цвет accent
- При активном сканировании — кольца ускоряются
- При успехе — все кольца схлопываются к центру, потом
  появляется CheckCircle2 с pop анимацией

**Вкладки:**
- Активная вкладка — подчёркивание снизу (2px линия), не фон
- Переключение вкладок — контент плавно меняется через FadeIn

**Инпуты (буквы + цифры):**
- Крупный моноширинный шрифт, letter-spacing 6
- Активный инпут — акцентная рамка с тенью цвета accent
- Плейсхолдер — пунктирные дефисы: - - -
- При заполнении — плавный переход цвета рамки

**Batch режим:**
- Счётчик — большое число с pop анимацией при каждом инкременте
- Прогресс-бар если задано целевое количество

**Success состояние:**
- Иконка CheckCircle2 — появляется через anim.success (pop)
- Слаг — появляется с задержкой 200ms после иконки
- Хаптик heavy + success при появлении

---

## СТРАНИЦА 3 — People

### Что улучшить:

**Поиск:**
- Иконка Search внутри инпута (левый паддинг)
- При фокусе — рамка меняет цвет через анимацию
- Кнопка очистки (X) появляется когда есть текст

**Контакты — карточки:**
- Аватар с уникальным градиентом (из первой буквы)
- При нажатии на карточку — ripple эффект или scale
- Кнопка ★ — анимация при нажатии: scale + цвет (anim.success)
- Staggered появление списка при загрузке

**Директория — grid:**
- Карточки с тенью и border-radius 16
- При нажатии на 🔔 — Bell иконка анимируется (покачивание)
  withSequence rotate -15 → 15 → -10 → 10 → 0

**Лидерборд:**
- Топ-3 — карточки с градиентным фоном:
  1-е место: gold gradient (#f59e0b → #d97706)
  2-е место: silver gradient (#9ca3af → #6b7280)
  3-е место: bronze gradient (#cd7c3a → #b45309)
- Остальные — обычные строки
- Позиция (число) — крупный Playfair Display
- При загрузке — карточки появляются сверху вниз с задержкой

---

## СТРАНИЦА 4 — Analytics

### Что улучшить:

**Hero метрика (486 тапов):**
- Анимация count-up при появлении экрана (0 → реальное значение за 1.5s)
- Процент роста — зелёный с TrendingUp иконкой

**Барчарт:**
- Bars — скруглённые сверху (borderTopLeftRadius, borderTopRightRadius)
- Активный день — акцентный цвет + тонкая тень
- Tooltip при нажатии на бар — показывает точное число
- Анимация появления — bars растут снизу вверх с stagger

**Спарклайн:**
- Заменить простую линию на линию с градиентной заливкой под ней
- Используй react-native-svg LinearGradient
- Точка последнего значения — пульсирующий dot

**Карта тапов:**
- SVG контур Узбекистана — добавить регионы (Ташкент, Самарканд и т.д)
- Точки тапов — пульсирующие круги (Reanimated withRepeat)
- При нажатии на точку — показать город и количество тапов

**Источники (прогресс-бары):**
- Анимация заполнения при появлении (width от 0 до реального %)
- Иконки перед каждым источником:
  NFC → Wifi, QR → QrCode, Прямая → Link

---

## СТРАНИЦА 5 — Profile

### Что улучшить:

**Аватар секция:**
- Если нет фото — градиентный круг с инициалом
- Градиент генерируется из slug (уникальный для каждого пользователя)
- Размер 72px, border 2px белый
- При нажатии — анимация scale 0.95 → 1

**QR + Share кнопки:**
- Фирменный QR (из компонента UnqxQRCode выше)
- Кнопка Share — LinearGradient фон (чёрный)
- При нажатии на QR — он увеличивается через Modal с FadeIn анимацией
  (полноэкранный просмотр QR с кнопкой скачать)

**Share Sheet (bottom sheet):**
- BlurView фон (expo-blur) вместо тёмного оверлея
- Кнопки соцсетей — в ряд, одинаковый стиль
- Анимация появления — slideUp (spring анимация снизу)
- Drag indicator сверху (серая полоска)
- Возможность свайпнуть вниз чтобы закрыть
  (react-native-gesture-handler PanGestureHandler)

**Редактор визитки:**
- Поля ввода — нижняя рамка вместо полной (underline style)
- При фокусе — нижняя линия оживляется акцентным цветом
- Выбор темы — живые превью-миниатюры (не просто текст)
- Выбор иконки для кнопок — анимированная сетка

**Настройки:**
- Toggle переключатели — плавная анимация через Reanimated
- Разделить на секции с заголовками (Внешний вид / Уведомления / Аккаунт)
- Chevron справа анимируется при нажатии (rotate 90°)

---

## СТРАНИЦА 6 — NFC Lock (Защита)

### Что улучшить:

**Поле пароля:**
- Точки-заполнители вместо звёздочек (кастомный компонент)
- Каждая введённая точка появляется с pop анимацией
- 4-8 точек в ряд — визуализация длины пароля

**Предупреждение:**
- AlertTriangle иконка с пульсирующим фоном (amber цвет)
- Текст предупреждения — не просто серый, а с акцентом на ключевые слова

---

## ГЛОБАЛЬНЫЕ УЛУЧШЕНИЯ — применить везде

### 1. Animated Pressable — заменить все кнопки
Каждый Pressable должен реагировать на нажатие:
```typescript
// Обернуть все Pressable
const AnimatedPressable = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));
  return (
    <Pressable
      onPressIn={() => { scale.value = anim.press; }}
      onPressOut={() => { scale.value = anim.release; }}
      onPress={onPress}
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
```

### 2. Staggered list появление
Каждый список при загрузке — элементы появляются
с задержкой 40-60ms между ними:
```typescript
// Для каждого элемента списка:
const opacity = useSharedValue(0);
const translateY = useSharedValue(20);

useEffect(() => {
  opacity.value = anim.fadeIn(index * 50);
  translateY.value = anim.slideUp(index * 50);
}, []);
```

### 3. Gradient аватары
Функция getAvatarGradient(slug) — генерирует уникальный
градиент из хэша строки. Одинаковый слаг = одинаковый
цвет у всех пользователей:
```typescript
const GRADIENTS = [
  ['#667eea', '#764ba2'], // purple
  ['#f093fb', '#f5576c'], // pink
  ['#4facfe', '#00f2fe'], // blue
  ['#43e97b', '#38f9d7'], // green
  ['#fa709a', '#fee140'], // sunset
  ['#a18cd1', '#fbc2eb'], // lavender
  ['#fda085', '#f6d365'], // peach
  ['#89f7fe', '#66a6ff'], // sky
];
const getAvatarGradient = (slug: string) => {
  const idx = slug.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
};
```

### 4. Skeleton с shimmer эффектом
Заменить статичный серый skeleton на анимированный shimmer:
```typescript
// Shimmer = градиент который движется слева направо
// Используй LinearGradient + Animated.Value translateX
// Цвета: #f0f0f0 → #e0e0e0 → #f0f0f0
```

### 5. Bottom Navigation
- Активная иконка — не просто другой цвет, а:
  маленький dot под иконкой + scale 1.1
- Переключение между табами — контент меняется через FadeIn
- При нажатии на активный таб — scroll to top

### 6. StatusBar
- На светлой теме — StatusBar dark (тёмный текст)
- На тёмной теме — StatusBar light (светлый текст)
- Меняется анимированно при переключении темы

### 7. Haptic feedback на все Pressable
Уже есть промт для haptics. Убедись что:
- Каждый AnimatedPressable вызывает haptics.light() в onPressIn
- Это делает приложение ощутимо более нативным

---

## УНИКАЛЬНЫЕ РЕШЕНИЯ ДЛЯ UNQX

### 1. NFC Success анимация — фирменная
При успешном скане вместо простой галочки:
- Круги расходятся от центра (как NFC волны) — зелёные
- Потом схлопываются
- В центре появляется CheckCircle2
- Всё это за 800ms

### 2. Слаг — фирменное отображение
Везде где показывается слаг (ALI001):
- Разделять на буквы и цифры: ALI · 001
- Моноширинный шрифт
- Letter-spacing 3-4
- Никогда не переносить

### 3. Tap counter — живой
На главном экране цифра тапов:
- При новом тапе (через SSE) — число анимированно
  увеличивается (count-up от текущего к новому)
- Лёгкий pulse эффект при обновлении

### 4. Тема — плавное переключение
При смене темы — не резкая смена, а:
- Всё приложение плавно меняет цвет за 400ms
- Через interpolateColor в Reanimated

### 5. Pull to refresh — кастомный индикатор
Вместо стандартного спиннера:
- Лого UNQX или иконка Wifi которая "заряжается"
- При растягивании — opacity растёт пропорционально

---

## Ресурсы для вдохновения

При реализации каждого экрана смотри на эти решения:

**Анимации:** Посмотри на Linear.app, Raycast, Apple Wallet
**Карточки:** Stripe Dashboard стиль — тень, отступы, типографика
**NFC иконки:** Material Symbols (google.github.io/material-design-icons)
**Градиенты:** uigradients.com — для аватаров и hero секций
**Spacing:** 8pt grid система — все отступы кратны 8

---

## Порядок работы

1. Установи все библиотеки из списка выше
2. Создай utils/animations.ts с пресетами
3. Создай UnqxQRCode компонент — фирменный QR
4. Создай AnimatedPressable — заменит все кнопки
5. Создай getAvatarGradient утилиту
6. Замени Skeleton на shimmer версию
7. Пройдись по каждому экрану в порядке: Home → NFC → People → Analytics → Profile
8. Примени глобальные улучшения

После каждого экрана — жди подтверждения перед следующим.

---

## Критерии готовности

- Каждый Pressable реагирует на нажатие (scale анимация)
- Каждый список появляется с stagger анимацией
- QR код фирменный с логотипом в центре
- Аватары с уникальными градиентами
- Skeleton с shimmer эффектом
- NFC области сканирования — premium анимация колец
- Bottom sheet с blur фоном и свайп для закрытия
- Слаг везде в формате ALI · 001
- Плавное переключение темы
- 0 слипшихся элементов, 0 произвольных отступов

## Важно
- Не трогай бизнес-логику и API вызовы
- Только визуальная сторона и анимации
- Все анимации через Reanimated — не через useState
- После каждого экрана жди подтверждения
- Если какой-то эффект технически сложен — предложи более простой аналог
```
