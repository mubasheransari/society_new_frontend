# NOC, Dashboard Chart, and Login Update

This build includes:

- Admin issued-NOC list now supports multiple API response shapes.
- Fallback loading for older backends: plot records are loaded from `/api/dues`, then issued NOCs are combined from `/api/noc/history/:plotNo`.
- Category Wise Unpaid Dues card alignment and spacing fixes.
- New responsive admin login design.
- New responsive resident login design.

Run:

```bash
npm install
npm run dev
```

The frontend API base URL remains configurable with:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```
