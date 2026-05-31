export const TEMPLATE_CATEGORIES = [
  'Кнопки',
  'Формы',
  'Карточки',
  'Навигация',
  'UI элементы',
  'Обратная связь',
  'Данные',
];

export const TEMPLATES = [
  // Кнопки
  { id: 'btn-primary', name: 'Primary Button', category: 'Кнопки', description: 'Основная CTA-кнопка с заливкой', preview: 'btn-primary' },
  { id: 'btn-secondary', name: 'Secondary Button', category: 'Кнопки', description: 'Кнопка с обводкой', preview: 'btn-secondary' },
  { id: 'btn-ghost', name: 'Ghost Button', category: 'Кнопки', description: 'Текстовая кнопка без фона', preview: 'btn-ghost' },
  { id: 'btn-danger', name: 'Danger Button', category: 'Кнопки', description: 'Деструктивное действие', preview: 'btn-danger' },
  { id: 'btn-icon', name: 'Icon Button', category: 'Кнопки', description: 'Квадратная кнопка с иконкой', preview: 'btn-icon' },
  { id: 'btn-segment', name: 'Segmented Control', category: 'Кнопки', description: 'Переключатель сегментов', preview: 'btn-segment' },

  // Формы
  { id: 'input-field', name: 'Input Field', category: 'Формы', description: 'Поле ввода с label и placeholder', preview: 'input-field' },
  { id: 'textarea', name: 'Text Area', category: 'Формы', description: 'Многострочное поле ввода', preview: 'textarea' },
  { id: 'search-bar', name: 'Search Bar', category: 'Формы', description: 'Строка поиска с иконкой', preview: 'search-bar' },
  { id: 'select-field', name: 'Select Field', category: 'Формы', description: 'Выпадающий список', preview: 'select-field' },
  { id: 'checkbox', name: 'Checkbox Row', category: 'Формы', description: 'Чекбокс с подписью', preview: 'checkbox' },
  { id: 'radio-group', name: 'Radio Group', category: 'Формы', description: 'Группа радиокнопок', preview: 'radio-group' },
  { id: 'file-upload', name: 'File Upload', category: 'Формы', description: 'Зона загрузки файла', preview: 'file-upload' },

  // Карточки
  { id: 'card', name: 'Content Card', category: 'Карточки', description: 'Карточка с заголовком и текстом', preview: 'card' },
  { id: 'stat-widget', name: 'Stat Widget', category: 'Карточки', description: 'Виджет метрики с числом', preview: 'stat-widget' },
  { id: 'product-card', name: 'Product Card', category: 'Карточки', description: 'Карточка товара с изображением', preview: 'product-card' },
  { id: 'pricing-card', name: 'Pricing Card', category: 'Карточки', description: 'Тарифный план', preview: 'pricing-card' },
  { id: 'profile-card', name: 'Profile Card', category: 'Карточки', description: 'Профиль пользователя', preview: 'profile-card' },

  // Навигация
  { id: 'navbar', name: 'Top Navbar', category: 'Навигация', description: 'Горизонтальная навигация', preview: 'navbar' },
  { id: 'sidebar', name: 'Sidebar Nav', category: 'Навигация', description: 'Вертикальное боковое меню', preview: 'sidebar' },
  { id: 'tabs', name: 'Tab Bar', category: 'Навигация', description: 'Вкладки переключения', preview: 'tabs' },
  { id: 'breadcrumb', name: 'Breadcrumbs', category: 'Навигация', description: 'Хлебные крошки', preview: 'breadcrumb' },
  { id: 'pagination', name: 'Pagination', category: 'Навигация', description: 'Постраничная навигация', preview: 'pagination' },

  // UI элементы
  { id: 'list-item', name: 'List Item', category: 'UI элементы', description: 'Строка списка с аватаром', preview: 'list-item' },
  { id: 'badge', name: 'Badge / Tag', category: 'UI элементы', description: 'Цветной тег-метка', preview: 'badge' },
  { id: 'modal', name: 'Modal Dialog', category: 'UI элементы', description: 'Модальное окно с кнопками', preview: 'modal' },
  { id: 'toggle-row', name: 'Toggle Row', category: 'UI элементы', description: 'Строка настройки с переключателем', preview: 'toggle-row' },
  { id: 'avatar-group', name: 'Avatar Group', category: 'UI элементы', description: 'Группа аватаров', preview: 'avatar-group' },
  { id: 'progress-bar', name: 'Progress Bar', category: 'UI элементы', description: 'Индикатор прогресса', preview: 'progress-bar' },
  { id: 'divider', name: 'Divider + Label', category: 'UI элементы', description: 'Разделитель с подписью', preview: 'divider' },

  // Обратная связь
  { id: 'alert-success', name: 'Alert Banner', category: 'Обратная связь', description: 'Информационный баннер', preview: 'alert-success' },
  { id: 'toast-notif', name: 'Toast', category: 'Обратная связь', description: 'Всплывающее уведомление', preview: 'toast-notif' },
  { id: 'empty-state', name: 'Empty State', category: 'Обратная связь', description: 'Пустое состояние экрана', preview: 'empty-state' },

  // Данные
  { id: 'table-row', name: 'Table Row', category: 'Данные', description: 'Строка таблицы', preview: 'table-row' },
  { id: 'chart-bar', name: 'Bar Chart', category: 'Данные', description: 'Простая столбчатая диаграмма', preview: 'chart-bar' },
];
