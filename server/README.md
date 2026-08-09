# Budget Tracker Backend

This backend exposes REST APIs for cards, categories, expenses, payments, loans, and savings goals.

## Setup

1. Install dependencies:

   ```bash
   cd server
   npm install
   ```

2. Copy the example environment file and set your MongoDB Atlas URI:

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm run dev
   ```

4. The API will run by default on `http://localhost:4000`.

## Available routes

- `GET /api/health`
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/cards/:id`
- `PUT /api/cards/:id`
- `DELETE /api/cards/:id`

- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/:id`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

- `GET /api/expenses`
- `POST /api/expenses`
- `GET /api/expenses/:id`
- `PUT /api/expenses/:id`
- `DELETE /api/expenses/:id`

- `GET /api/payments`
- `POST /api/payments`
- `GET /api/payments/:id`
- `PUT /api/payments/:id`
- `DELETE /api/payments/:id`

- `GET /api/loans`
- `POST /api/loans`
- `GET /api/loans/:id`
- `PUT /api/loans/:id`
- `DELETE /api/loans/:id`

- `GET /api/savings-goals`
- `POST /api/savings-goals`
- `GET /api/savings-goals/:id`
- `PUT /api/savings-goals/:id`
- `DELETE /api/savings-goals/:id`
