# API CONTRACT

## 1. Change Log

Date | Note
---|---
2025-09-24 | Initial draft: core APIs for auth, watchlist, portfolio, coins/prices, transactions, simulations, profile.
2025-10-24 | Added CoinGecko proxy, token refresh, CSRF, market data, current prices endpoint improvements, profile currency validation.

---

## 2. Error Codes

Code | Explanation
---|---
0 | Success
1000 | Validation error / bad request
1001 | Authentication failed / unauthorized
1002 | Not found
1003 | Conflict (e.g., duplicate resource)
2000 | Insufficient funds / business rule failed
3000 | Internal server error

---

## 3. API Contract

- All request/response bodies are JSON unless specified.
- IDs are strings (UUID or coin_id).
- Timestamps are ISO 8601.
- Prices/amounts are decimal strings.
- Auth: session cookie + CSRF for browser, Bearer token for API clients.
- Test: python -m pytest --cov=. --cov-report=html

---

## 4. Endpoints

### 4.1 Health Check

**GET** `/health`  
**Auth:** none  

```json
{ "status": "ok", "time": "2025-09-24T12:00:00Z", "code": 0 }
```

### 4.2 CSRF Cookie

**GET** /api/csrf-cookie/
**Auth:** none

```json
{ "detail": "ok", "code": 0 }
```

### 4.3 Auth: Register

**POST** /api/auth/register/  
**Auth:** none

Request:

```json
"
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd!",
  "display_name": "Alice"
}
```

Responses:

```json
201 Created
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Alice",
  "is_active": true,
  "code": 0
}

400 Validation error
{ "detail": "...", "code": 1000 }

409 Conflict
{ "detail":"email exists","code":1003 }
```

### 4.4 Auth: Login

**POST** /api/auth/login/
**Auth:** none

Request:

```json
{ "email": "user@example.com", "password": "password" }
```

Responses:

```json
200 OK
{
  "user_id": "uuid",
  "email": "user@example.com",
  "access_token": "jwt-access-token",
  "code": 0
}

401 Unauthorized
{ "detail":"invalid credentials","code":1001 }
```

Sets HTTP-only refresh token cookie.

### 4.5 Auth: Refresh Token

**GET** /api/accounts/refresh-token/
**Auth:** cookie-based refresh token

Response:

```json
200 OK
{
  "access_token": "jwt-access-token",
  "code": 0
}

401 Unauthorized
{ "detail":"No refresh token","code":1001 }
```

### 4.6 Auth: Logout

**POST** /api/accounts/logout/
**Auth:** Required. Deletes session and cookie-based refresh token

Response:

```json
204 No Content or
{ "detail": "logged out", "code": 0 }
```

### 4.7 Password Reset Request

**POST** /api/accounts/password-reset/
**Auth:** none

Request:

```json
{ "email": "user@example.com" }
```

Response:

```json
200 OK
{ "detail": "reset email queued if account exists", "code": 0 }
```

### 4.8 Password Reset Confirm

**POST** /api/accounts/password-reset-confirm/
**Auth:** none

Request:

```json
{ "token": "reset-token", "new_password": "NewStrongP@ss1" }
```

Response:

```json
200 OK
{ "detail":"password updated","code":0 }

400 Invalid/expired token
{ "detail":"invalid token","code":1000 }
```

### 4.9 Profile: Get / Update

**GET / PUT** /api/accounts/profile/
**Auth:** Required

Request (PUT):

```json
{
  "display_name":"Alice M",
  "preferred_currency":"EUR",
  "timezone":"Europe/Berlin",
  "date_format":"DD-MM-YYYY"
}
```

Responses:

```json
200 OK
{
  "id":"uuid",
  "email":"user@example.com",
  "display_name":"Alice",
  "preferred_currency":"USD",
  "timezone":"Australia/Sydney",
  "date_format":"YYYY-MM-DD",
  "code": 0
}

400 Validation error
{ "detail":"invalid currency or data","code":1000 }
```

### 4.10 CoinGecko Proxy

**GET** /api/coingecko-proxy/?endpoint={endpoint}&params=...
**Auth:** optional. Endpoint examples: simple/price, coins/markets, coins/{id}

Response:

```json
200 OK
{
  "data": {...},
  "code": 0
}
```

Errors:

```json
400 Bad request
{ "detail": "endpoint parameter required", "code": 1000 }

503 Service unavailable
{ "detail": "failed to fetch data", "code": 3000 }
```

### 4.11 Market Data

**GET** /api/market-data/?currency=USD&limit=50&sparkline=false
**Auth:** optional

Response:

```json
{
  "data": [
    {
      "id":"bitcoin",
      "symbol":"btc",
      "current_price":"67420.00",
      "market_cap":"1200000000000",
      "price_change_24h":"-1.23",
      "sparkline": [...],
      "price_change_percentage": { "1h": "...", "24h": "...", "7d": "..." }
    }
  ],
  "code":0
}
```

### 4.12 Prices: Current

**GET** /api/prices/current/?coin_ids=bitcoin,ethereum&currency=USD
**Auth:** None

Response:

```json
{
  "bitcoin": { "usd": "7200.00" },
  "ethereum": { "usd": "320.50" },
  "code": 0
}
```

Fallback to cached CurrentPrice if CoinGecko fails.

### 4.13 PriceCache: History

**GET** /api/price-cache/?coin_id=bitcoin&start=2025-09-01T00:00:00Z&end=2025-09-24T00:00:00Z&limit=100
**Auth:** None

Response:

```json
{
  "coin_id":"bitcoin",
  "prices":[
    {
      "id":"uuid",
      "price":"67000.00",
      "currency":"USD",
      "price_date":"2025-09-23T12:00:00Z",
      "fetched_at":"2025-09-23T12:01:00Z",
      "source":"coingecko"
    }
  ],
  "code":0
}
```

### 4.14 Coins: List / Detail

**GET** /api/coins/ (List)
**GET** /api/coins/{coin_id}/ (Detail)
**Auth:** None

Response (List):

```json
{
  "page":1,
  "results":[{ "id":"bitcoin", "symbol":"btc", "name":"Bitcoin" }],
  "code":0
}
```

Response (Detail):

```json
{
  "id":"bitcoin",
  "symbol":"btc",
  "name":"Bitcoin",
  "current_price":"67420.00",
  "market_cap":"1200000000000",
  "price_history":[...],
  "code":0
}
```

### 4.15 Watchlist: List / Add / Remove

**GET / POST / DELETE** /api/watchlist/
**Auth:** Required

GET: list user's watchlist

POST: add coin

DELETE: /api/watchlist/{id}/: remove coin

Response : Conflicts (1003) if coin exists.

### 4.16 Transactions: Create / List

**POST** /api/transactions/
**GET** /api/transactions/?portfolio_id={uuid}&page=1
**Auth:** Required

POST: Create BUY/SELL transaction

GET: list paginated transactions

### 4.17 Transactions: List (by portfolio)

**GET** `/api/transactions/?portfolio_id={uuid}&page=1`  
**Auth:** required  
**Response 200:** paginated list of transactions

### 4.18 Simulations: List

**GET** `/api/simulations/`  
**Auth:** required  
**Response 200**

```json
[
  {
    "id":"uuid",
    "name":"Backtest 2020",
    "start_date":"2020-01-01",
    "initial_cash":"10000.00",
    "status":"ACTIVE"
  }
]
```

### 4.19 Simulations: Create

**POST** `/api/simulations/`  
**Auth:** required  
**Request**

```json
{
  "name":"Backtest 2020",
  "start_date":"2020-01-01",
  "end_date":"2020-12-31",
  "initial_cash":"10000.00",
  "selected_coins":["bitcoin","ethereum"]
}
```

Response:

```json
201 Created
{
  "id":"uuid",
  "user_id":"uuid",
  "start_date":"2020-01-01",
  "initial_cash":"10000.00",
  "code":0
}
```

### 4.20 Simulation: Detail / Summary

**GET** `/api/simulations/{id}/`  
**Auth:** required (owner)  
**Response 200**

```json
{
  "id":"uuid",
  "name":"Backtest 2020",
  "start_date":"2020-01-01",
  "current_value":"12500.00",
  "holdings":[...],
  "transactions":[...],
  "code":0
}
```

### 4.21 Simulation: Update

**PUT** `/api/simulations/{id}/`  
**Auth:** required (owner)  
**Request:** editable fields (name, end_date, status, selected_coins)  
**Response:** 200 OK updated simulation

### 4.22 Simulation: Delete

**DELETE** `/api/simulations/{id}/`  
**Auth:** required (owner)  
**Response:** 204 No Content

### 4.23 Simulation: Transaction (within simulation)

**POST** `/api/simulations/{id}/transactions/`  
**Auth:** required (owner)  
**Request**

```json
{
  "coin_id":"bitcoin",
  "type":"BUY",
  "quantity":"0.5",
  "price_date":"2020-01-05"
}
```

**Response 201 Created** uses simulation prices for price_date
