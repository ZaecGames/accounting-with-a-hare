# Учёт материальных ресурсов (диплом)

Веб-приложение: ТМЦ, склады, приход/расход/перемещение, остатки, XML, роли админ/сотрудник.

## Быстро: загрузить на GitHub и выложить онлайн

Пошаговая инструкция на русском — файл **`INSTRUKCIYA_GITHUB.txt`** в этой же папке.

## Локально

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Открыть: http://127.0.0.1:8000/ (логин `admin` / `admin`, если база новая).

## Файлы для сети

| Файл | Назначение |
|------|------------|
| `.gitignore` | Что не попадает в GitHub |
| `vercel.json` | Сборка фронта на [Vercel](https://vercel.com) |
| `render.yaml` | API на [Render](https://render.com) |
| `frontend/.env.example` | Переменная `VITE_API_URL` для Vercel |
| `backend/.env.example` | Переменные для сервера |

На Vercel в настройках проекта задайте **`VITE_API_URL`** = URL вашего API с Render (без `/` в конце).

## Структура

- `backend/` — Python, FastAPI, SQLite, встроенная HTML-страница
- `frontend/` — React + Vite (опционально)
