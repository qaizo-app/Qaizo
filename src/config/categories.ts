// src/config/categories.ts
// SINGLE SOURCE for the built-in category catalog. Everything below used to
// live copy-pasted in 6 files (theme/colors, dataService, CategoryPickerModal,
// CategoriesScreen, AddTransactionModal, AddRecurringModal) — adding one
// category meant touching all of them and missing one caused raw-id bugs.
// The values are moved here verbatim; consumers re-export where their old
// import path is part of the public surface.
//
// NOTE: categoryConfig and DEFAULT_CATEGORIES intentionally keep their
// historical (slightly different) colors — unifying them would silently
// recolor existing users' categories.

// Категории транзакций — Feather icons (не зависят от темы)
export const categoryConfig = {
  food:           { icon: 'shopping-cart', color: '#fb7185' },
  restaurant:     { icon: 'coffee',        color: '#f97316' },
  transport:      { icon: 'navigation',    color: '#fb923c' },
  fuel:           { icon: 'droplet',       color: '#f59e0b' },
  health:         { icon: 'heart',         color: '#f472b6' },
  phone:          { icon: 'smartphone',    color: '#a78bfa' },
  utilities:      { icon: 'zap',           color: '#60a5fa' },
  clothing:       { icon: 'shopping-bag',  color: '#c084fc' },
  household:      { icon: 'home',          color: '#818cf8' },
  kids:           { icon: 'smile',         color: '#fb7185' },
  entertainment:  { icon: 'film',          color: '#22d3ee' },
  education:      { icon: 'book-open',     color: '#2dd4bf' },
  cosmetics:      { icon: 'scissors',      color: '#ec4899' },
  electronics:    { icon: 'cpu',           color: '#3b82f6' },
  insurance:      { icon: 'shield',        color: '#fbbf24' },
  rent:           { icon: 'key',           color: '#f87171' },
  arnona:         { icon: 'map-pin',       color: '#ef4444' },
  vaad:           { icon: 'users',         color: '#dc2626' },
  other:          { icon: 'more-horizontal', color: '#64748b' },
  salary_me:      { icon: 'briefcase',     color: '#34d399' },
  salary_spouse:  { icon: 'briefcase',     color: '#10b981' },
  rental_income:  { icon: 'home',          color: '#059669' },
  handyman:       { icon: 'tool',          color: '#2dd4bf' },
  sales:          { icon: 'package',       color: '#6ee7b7' },
  keren_hishtalmut: { icon: 'trending-up', color: '#14b8a6' },
  pension:        { icon: 'umbrella',      color: '#0891b2' },
  other_income:   { icon: 'plus-circle',   color: '#a7f3d0' },
  transfer:       { icon: 'repeat',        color: '#60a5fa' },
};

// Built-in income category ids; the expense list is "everything else".
export const INCOME_CATEGORY_IDS = ['salary_me', 'salary_spouse', 'rental_income', 'handyman', 'sales', 'keren_hishtalmut', 'pension', 'other_income'];

export const EXP_CATEGORY_IDS = Object.keys(categoryConfig).filter(k => ![...INCOME_CATEGORY_IDS, 'transfer'].includes(k));

// Default seed for dataService.getCategories (guest/new users). Kept as its
// own verbatim list — see NOTE above about historical color drift.
export const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary_me', icon: 'briefcase', color: '#22c55e' },
    { id: 'salary_spouse', icon: 'briefcase', color: '#10b981' },
    { id: 'handyman', icon: 'tool', color: '#34d399' },
    { id: 'sales', icon: 'package', color: '#6ee7b7' },
    { id: 'rental_income', icon: 'home', color: '#059669' },
    { id: 'keren_hishtalmut', icon: 'trending-up', color: '#14b8a6' },
    { id: 'pension', icon: 'umbrella', color: '#0891b2' },
    { id: 'other_income', icon: 'plus-circle', color: '#a7f3d0' },
  ],
  expense: [
    { id: 'food', icon: 'shopping-cart', color: '#ef4444' },
    { id: 'transport', icon: 'navigation', color: '#f97316' },
    { id: 'fuel', icon: 'droplet', color: '#f59e0b' },
    { id: 'insurance', icon: 'shield', color: '#eab308' },
    { id: 'phone', icon: 'smartphone', color: '#8b5cf6' },
    { id: 'utilities', icon: 'zap', color: '#3b82f6' },
    { id: 'health', icon: 'heart', color: '#ec4899' },
    { id: 'kids', icon: 'smile', color: '#f472b6' },
    { id: 'clothing', icon: 'shopping-bag', color: '#a855f7' },
    { id: 'entertainment', icon: 'film', color: '#06b6d4' },
    { id: 'education', icon: 'book-open', color: '#14b8a6' },
    { id: 'rent', icon: 'key', color: '#dc2626' },
    { id: 'arnona', icon: 'map-pin', color: '#ef4444' },
    { id: 'vaad', icon: 'users', color: '#991b1b' },
    { id: 'restaurant', icon: 'coffee', color: '#e11d48' },
    { id: 'household', icon: 'home', color: '#7c3aed' },
    { id: 'electronics', icon: 'cpu', color: '#2563eb' },
    { id: 'cosmetics', icon: 'scissors', color: '#db2777' },
    { id: 'other', icon: 'more-horizontal', color: '#6b7280' },
  ],
};

// Two-level default tree for the category picker / categories screen.
export const DEFAULT_GROUPS = [
  { id: 'home', name: { ru:'Дом', he:'בית', en:'Home' }, icon: 'home', color: '#60a5fa',
    subs: [
      { id:'electricity', name:{ru:'Электричество',he:'חשמל',en:'Electricity'}, icon:'zap' },
      { id:'water', name:{ru:'Вода',he:'מים',en:'Water'}, icon:'droplet' },
      { id:'gas', name:{ru:'Газ',he:'גז',en:'Gas'}, icon:'sun' },
      { id:'arnona', name:{ru:'Налог на жильё',he:'ארנונה',en:'Property Tax'}, icon:'map-pin' },
      { id:'vaad', name:{ru:'Обслуживание дома',he:'ועד בית',en:'Building Fee'}, icon:'users' },
      { id:'cleaning', name:{ru:'Уборка',he:'ניקיון',en:'Cleaning'}, icon:'umbrella' },
      { id:'internet', name:{ru:'Интернет',he:'אינטרנט',en:'Internet'}, icon:'globe' },
      { id:'repairs', name:{ru:'Ремонт',he:'תיקונים',en:'Repairs'}, icon:'tool' },
    ]},
  { id: 'food', name: { ru:'Еда и продукты', he:'אוכל ומצרכים', en:'Food & Grocery' }, icon: 'shopping-cart', color: '#fb7185',
    subs: [
      { id:'grocery', name:{ru:'Супермаркет',he:'סופרמרקט',en:'Grocery'}, icon:'shopping-cart' },
      { id:'restaurant', name:{ru:'Рестораны',he:'מסעדות',en:'Restaurants'}, icon:'coffee' },
      { id:'fastfood', name:{ru:'Фастфуд',he:'מזון מהיר',en:'Fast Food'}, icon:'coffee' },
      { id:'delivery', name:{ru:'Доставка',he:'משלוחים',en:'Delivery'}, icon:'truck' },
    ]},
  { id: 'transport', name: { ru:'Авто и транспорт', he:'רכב ותחבורה', en:'Auto & Transport' }, icon: 'navigation', color: '#fb923c',
    subs: [
      { id:'fuel', name:{ru:'Топливо',he:'דלק',en:'Fuel'}, icon:'droplet' },
      { id:'parking', name:{ru:'Парковка',he:'חניה',en:'Parking'}, icon:'map-pin' },
      { id:'car_insurance', name:{ru:'Страховка авто',he:'ביטוח רכב',en:'Car Insurance'}, icon:'shield' },
      { id:'car_repair', name:{ru:'Ремонт авто',he:'תיקון רכב',en:'Car Repair'}, icon:'tool' },
      { id:'public_transport', name:{ru:'Общ. транспорт',he:'תח"צ',en:'Public Transit'}, icon:'navigation' },
    ]},
  { id: 'health', name: { ru:'Здоровье', he:'בריאות', en:'Health' }, icon: 'heart', color: '#f472b6',
    subs: [
      { id:'doctor', name:{ru:'Врач',he:'רופא',en:'Doctor'}, icon:'heart' },
      { id:'pharmacy', name:{ru:'Аптека',he:'בית מרקחת',en:'Pharmacy'}, icon:'plus-circle' },
      { id:'dentist', name:{ru:'Стоматолог',he:'רופא שיניים',en:'Dentist'}, icon:'smile' },
      { id:'health_insurance', name:{ru:'Мед. страховка',he:'ביטוח בריאות',en:'Health Insurance'}, icon:'shield' },
    ]},
  { id: 'entertainment', name: { ru:'Развлечения', he:'בילויים', en:'Entertainment' }, icon: 'film', color: '#22d3ee',
    subs: [
      { id:'movies', name:{ru:'Кино',he:'קולנוע',en:'Movies'}, icon:'film' },
      { id:'subscriptions', name:{ru:'Подписки',he:'מנויים',en:'Subscriptions'}, icon:'layers' },
      { id:'hobbies', name:{ru:'Хобби',he:'תחביבים',en:'Hobbies'}, icon:'star' },
      { id:'sports', name:{ru:'Спорт',he:'ספורט',en:'Sports'}, icon:'target' },
    ]},
  { id: 'travel', name: { ru:'Путешествия', he:'נסיעות', en:'Travel' }, icon: 'globe', color: '#2dd4bf',
    subs: [
      { id:'flights', name:{ru:'Авиабилеты',he:'טיסות',en:'Flights'}, icon:'navigation' },
      { id:'hotels', name:{ru:'Гостиницы',he:'מלונות',en:'Hotels'}, icon:'home' },
      { id:'travel_food', name:{ru:'Еда в поездке',he:'אוכל בנסיעה',en:'Travel Food'}, icon:'coffee' },
    ]},
  { id: 'kids', name: { ru:'Дети', he:'ילדים', en:'Kids' }, icon: 'smile', color: '#a78bfa',
    subs: [
      { id:'school', name:{ru:'Школа/садик',he:'בית ספר/גן',en:'School'}, icon:'book-open' },
      { id:'kids_clothes', name:{ru:'Одежда детям',he:'ביגוד ילדים',en:'Kids Clothes'}, icon:'shopping-bag' },
      { id:'toys', name:{ru:'Игрушки',he:'צעצועים',en:'Toys'}, icon:'gift' },
      { id:'kids_activities', name:{ru:'Кружки',he:'חוגים',en:'Activities'}, icon:'star' },
    ]},
  { id: 'personal', name: { ru:'Личное', he:'אישי', en:'Personal' }, icon: 'user', color: '#c084fc',
    subs: [
      { id:'clothing', name:{ru:'Одежда',he:'ביגוד',en:'Clothing'}, icon:'shopping-bag' },
      { id:'cosmetics', name:{ru:'Косметика',he:'קוסמטיקה',en:'Cosmetics'}, icon:'scissors' },
      { id:'gifts', name:{ru:'Подарки',he:'מתנות',en:'Gifts'}, icon:'gift' },
    ]},
  { id: 'income_group', name: { ru:'Доходы', he:'הכנסות', en:'Income' }, icon: 'briefcase', color: '#34d399',
    subs: [
      { id:'salary_me', name:{ru:'Зарплата',he:'משכורת',en:'Salary'}, icon:'briefcase' },
      { id:'salary_spouse', name:{ru:'Зарплата (супруг)',he:'משכורת (בן/בת זוג)',en:'Salary (spouse)'}, icon:'briefcase' },
      { id:'rental_income', name:{ru:'Аренда',he:'שכירות',en:'Rental'}, icon:'home' },
      { id:'handyman', name:{ru:'Подработка',he:'עבודה נוספת',en:'Side Job'}, icon:'tool' },
      { id:'sales', name:{ru:'Продажи',he:'מכירות',en:'Sales'}, icon:'package' },
      { id:'keren_hishtalmut', name:{ru:'Керен иштальмут',he:'קרן השתלמות',en:'Study Fund'}, icon:'trending-up' },
      { id:'pension', name:{ru:'Пенсия',he:'פנסיה',en:'Pension'}, icon:'umbrella' },
    ]},
];
