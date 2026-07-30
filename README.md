# Invoice Frontend

Frontend works with the PostgreSQL-backed backend without major UI changes.

## Setup

1. Install packages

```bash
npm install
```

2. Create `.env.local` from `.env.example`

```bash
cp .env.example .env.local
```

3. Run frontend

```bash
npm run dev
```

## Environment

- `NEXT_PUBLIC_API_BASE_URL` should point to your backend, for example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## Category charges update

Category Charges page now shows both actual and discounted charges:

- Owner actual charges
- Owner discounted charges
- Owner discount/month
- Rental actual charges
- Rental discounted charges
- Rental discount/month
- Add new category
- Delete category
- Save all category charges

Add House page now displays actual charge, discounted charge, and discount according to selected plot category and dues type.
# society_new_frontend
