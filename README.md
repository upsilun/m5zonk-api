# 🚀 M5zonk API - Backend Documentation

## Overview

**M5zonk API** is a complete accounting and inventory backend for eCommerce businesses. It's built with Node.js (Express) and uses Firestore as a database for all data, including custom user accounts and sessions.

This documentation details every available endpoint, its parameters, and expected responses, providing a clear guide for front-end development or API integration.

**Base URL:** `http://localhost:3000/api`

-----

## Authentication & Global Headers

All protected endpoints require a session token.

### 🔑 `X-Session-Token` (Required Header)

After logging in, you will receive a `token`. This token must be sent in the `X-Session-Token` header for **all endpoints** except `/auth/signup` and `/auth/login`.

**Example:**
`X-Session-Token: 2fdd70db427310f88ff91988f46bf47abf1607e3003450fb6243c33b69c945b4`

-----

## 1\. Authentication Module

Handles user signup, login, and sessions.

### `POST /auth/signup`

Creates a new admin account, an "owner" user, a default warehouse, and default settings.

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | `string` | **Required.** The user's email address. Must be unique. |
| `password` | `string` | **Required.** The user's password (min 6 characters). |
| `businessName` | `string` | **Required.** The name of the user's business. |

**Success Response (201 Created):**

```json
{
  "message": "Admin account created successfully.",
  "adminId": "OHBm0jvBxJGTgIsFAG7o"
}
```

**Error Response (409 Conflict):**

```json
{
  "status": "fail",
  "message": "An account with this email already exists."
}
```

### `POST /auth/login`

Logs in a user and creates a new 5-month session.

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | `string` | **Required.** The user's email address. |
| `password` | `string` | **Required.** The user's password. |

**Success Response (200 OK):**
This response contains the `token` you must use for all future authenticated requests.

```json
{
  "message": "Login successful.",
  "token": "2fdd70db427310f88ff91988f46bf47abf1607e3003450fb6243c33b69c945b4",
  "adminId": "OHBm0jvBxJGTgIsFAG7o",
  "userId": "hrxlGWuyXqdbaqRtuRsh",
  "role": "owner",
  "expiresAt": "2026-03-27T15:23:46.306Z"
}
```

**Error Response (401 Unauthorized):**

```json
{
  "status": "fail",
  "message": "Invalid email or password."
}
```

### `POST /auth/logout`

Logs the user out. (Note: In this MVP, it sends a success message. The client is responsible for deleting the token).

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**

```json
{
  "message": "Logged out successfully."
}
```

-----

## 2\. Warehouse Management

Manage stock locations. Requires `X-Session-Token`.

### `GET /warehouses`

Lists all warehouses for the admin.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**

```json
[
  {
    "id": "qLpM...s7dK",
    "name": "Default",
    "active": true,
    "createdAt": { "_seconds": 167... }
  },
  {
    "id": "newWarehouseId123",
    "name": "Main Stockroom",
    "active": true,
    "createdAt": { "_seconds": 168... }
  }
]
```

### `POST /warehouses`

Creates a new warehouse.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | **Required.** The name of the warehouse (e.g., "Main Stockroom"). |

**Success Response (201 Created):**

```json
{
  "id": "newWarehouseId123",
  "name": "Main Stockroom",
  "active": true
}
```

### `PUT /warehouses/:id`

Updates the name or status of a specific warehouse.

**URL Parameters:**

  * `:id`: The Firestore document ID of the warehouse.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):** (At least one field is required)

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | *Optional.* The new name for the warehouse. |
| `active` | `boolean` | *Optional.* Set to `false` to archive the warehouse. |

**Success Response (200 OK):**

```json
{
  "id": "newWarehouseId123",
  "name": "Renamed Stockroom",
  "active": false
}
```

-----

## 3\. Packaging Presets

Manage reusable packaging costs. Requires `X-Session-Token`.

### `GET /packaging`

Lists all *active* packaging presets.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**

```json
[
  {
    "id": "abc...",
    "name": "Small Package",
    "price": 2,
    "active": true
  },
  {
    "id": "def...",
    "name": "Medium Package",
    "price": 5,
    "active": true
  }
]
```

### `POST /packaging`

Creates a new packaging preset.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | **Required.** Name of the item (e.g., "Bubble Wrap"). |
| `price` | `number` | **Required.** Cost of this item. |

**Success Response (201 Created):**

```json
{
  "id": "newPresetId456",
  "name": "Bubble Wrap",
  "price": 0.5,
  "active": true
}
```

### `PUT /packaging/:id`

Updates a specific packaging preset.

**URL Parameters:**

  * `:id`: The Firestore document ID of the preset.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):** (At least one field is required)

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | *Optional.* The new name. |
| `price` | `number` | *Optional.* The new price. |
| `active` | `boolean`| *Optional.* Set to `false` to archive. |

**Success Response (200 OK):**

```json
{
  "id": "newPresetId456",
  "price": 0.75,
  "active": false
}
```

-----

## 4\. Product Management

Manage inventory items. Requires `X-Session-Token`.

### `POST /products`

Creates a new product.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | **Required.** Product name (e.g., "Red T-Shirt"). |
| `stockPrice` | `number` | **Required.** Cost to acquire the product (COGS). |
| `sellPrice` | `number` | **Required.** Price to the customer. |
| `idCode` | `string` | *Optional.* A short, unique ID (e.g., "RT001"). If not provided, a random one is generated. |
| `quantityType`| `string` | *Optional.* `'finite'` or `'infinite'`. Defaults to `'finite'`. |
| `quantity` | `number` | *Optional.* The global stock level. Defaults to `0`. |
| `perWarehouse`| `object` | *Optional.* An object to track stock per warehouse. (See example below). |
| `imageUrl` | `string` | *Optional.* A URL to the product's image. |
| `active` | `boolean`| *Optional.* Defaults to `true`. |

**`perWarehouse` Object Example:**

```json
{
  "perWarehouse": {
    "warehouseId123": { "quantityType": "finite", "quantity": 50 },
    "warehouseId456": { "quantityType": "finite", "quantity": 25 }
  }
}
```

**Success Response (201 Created):**

```json
{
  "id": "productDocId123",
  "idCode": "AB12",
  "name": "Red T-Shirt",
  "stockPrice": 15,
  "sellPrice": 30,
  "quantityType": "finite",
  "quantity": 100,
  "warehouseIds": [],
  "grouping": { "mode": "auto", "groupKey": "red t-shirt" },
  "active": true,
  "createdAt": { ... },
  "updatedAt": { ... }
}
```

### `GET /products/list`

Lists all products with pagination, with an optional filter for a specific warehouse.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Query Parameters:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `limit` | `number` | *Optional.* Number of products to return. Default `50`, Max `100`. |
| `startAfter`| `string` | *Optional.* A product document ID to start the next page from. (Use `nextCursor` from the previous response). |
| `warehouseId`| `string` | *Optional.* Filters for products that exist in this specific warehouse. **Requires a Firestore Index.** |

**Success Response (200 OK):**

```json
{
  "products": [
    {
      "id": "productDocId123",
      "name": "Red T-Shirt",
      "idCode": "AB12",
      "sellPrice": 35
      // ... other product fields
    }
    // ... (up to 'limit' products)
  ],
  "nextCursor": "nextProductDocId456"
}
```

### `GET /products`

Searches for products by `idCode` or `name`.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Query Parameters:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `query` | `string` | **Required.** The search term (e.g., "Red" or "AB12"). |
| `mode` | `string` | *Optional.* `'prefix'` (default) or `'exact'`. |

**Success Response (200 OK):**

```json
[
  {
    "id": "productDocId123",
    "name": "Red T-Shirt",
    "idCode": "AB12",
    "sellPrice": 35
    // ... other product fields
  }
]
```

### `GET /products/:id`

Gets a single product by its Firestore document ID.

**URL Parameters:**

  * `:id`: The Firestore document ID of the product.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**
Returns the full product object.

### `PUT /products/:id`

Updates a specific product.

**URL Parameters:**

  * `:id`: The Firestore document ID of the product.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**
Send any fields from the `POST /products` body. At least one field is required.

**Success Response (200 OK):**

```json
{
  "id": "productDocId123",
  "sellPrice": 35,
  "active": false,
  "updatedAt": { ... }
}
```

### `POST /products/:id/stock-adjust`

Manually adds or removes stock from a product.

**URL Parameters:**

  * `:id`: The Firestore document ID of the product.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `changeQty` | `number` | **Required.** The amount to change. Use `5` to add 5, use `-3` to remove 3. |
| `warehouseId` | `string` | *Optional.* The warehouse to adjust. If omitted, adjusts the global `quantity`. |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Stock adjusted successfully."
}
```

-----

## 5\. Order Management

Create and view sales orders. Requires `X-Session-Token`.

### `POST /orders`

Creates a new sales order. This is a transactional endpoint: it calculates profit, decrements stock, and updates financial metrics all at once.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Request Body (`application/json`):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `lines` | `array` | **Required.** An array of `OrderLine` objects. |
| `shippingPrice` | `number` | *Optional.* Cost for shipping. Defaults to `0`. |
| `extraLosses` | `number` | *Optional.* Any other expenses. Defaults to `0`. |
| `packagingItems`| `array` | *Optional.* An array of `PackagingItem` objects. |
| `warehouseId` | `string` | *Optional.* The warehouse to pull stock from. If omitted, uses the admin's default warehouse. |
| `createdAt` | `string` | *Optional.* An **ISO 8601 Date String** (e.g., `"2025-01-10T12:00:00.000Z"`) to back-date an order. Defaults to `now`. |

**`OrderLine` Object:**
| Field | Type | Description |
| :--- | :--- | :--- |
| `productId` | `string` | **Required.** The Firestore document ID of the product. |
| `qty` | `number` | **Required.** The quantity being sold. |
| `unitSellPrice` | `number` | *Optional.* Overrides the product's default `sellPrice`. |
| `unitStockPrice`| `number` | *Optional.* Overrides the product's default `stockPrice`. |

**`PackagingItem` Object:**
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | **Required.** Name of the item (e.g., "Small Package"). |
| `price` | `number` | **Required.** Price of the item. |

**Success Response (201 Created):**
The new order object is returned with a calculated `totals` block.

```json
{
  "id": "newOrderId789",
  "createdAt": { ... },
  "warehouseId": "yourDefaultWarehouseId...",
  "lines": [
    {
      "productId": "productDocId123",
      "idCode": "AB12",
      "name": "Red T-Shirt",
      "qty": 1,
      "unitSellPrice": 35,
      "unitStockPrice": 15
    }
  ],
  "shippingPrice": 10,
  "extraLosses": 0,
  "packagingItems": [
    { "name": "Small Package", "price": 2 }
  ],
  "totals": {
    "revenue": 35,
    "cogs": 15,
    "expenses": 12,
    "profit": 8,
    "profitPct": 0.228...
  }
}
```

**Error Response (409 Conflict):**

```json
{
  "status": "fail",
  "message": "Not enough stock for Red T-Shirt. Available: 0"
}
```

### `GET /orders`

Lists all historical orders with optional filters.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Query Parameters:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `month` | `string` | *Optional.* Filters by month. Format: `"YYYY-MM"` (e.g., `"2025-01"`). |
| `warehouseId`| `string` | *Optional.* Filters by a specific warehouse ID. |

**Success Response (200 OK):**
Returns an array of order objects.

### `GET /orders/:id`

Gets a single order by its Firestore document ID.

**URL Parameters:**

  * `:id`: The Firestore document ID of the order.

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**
Returns the full order object.

-----

## 6\. Financial Metrics

Read auto-generated financial summaries. Requires `X-Session-Token`.

### `GET /metrics/year/:year`

Gets a summary of all months in a given year, plus a grand total for the year.

**URL Parameters:**

  * `:year`: The year to query (e.g., `2025`).

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**

```json
{
  "year": "2025",
  "totals": {
    "revenue": 525,
    "cogs": 165,
    "expenses": 12,
    "profit": 348,
    "orderCount": 2
  },
  "months": [
    {
      "month": "2025-01",
      "revenue": 490,
      "cogs": 150,
      // ...
      "orderCount": 1
    },
    {
      "month": "2025-10",
      "revenue": 35,
      "cogs": 15,
      // ...
      "orderCount": 1
    }
  ]
}
```

### `GET /metrics/month/:year/:month/weekly`

Gets a weekly breakdown for a specific month. This is generated on-the-fly by grouping that month's orders by ISO week.

**URL Parameters:**

  * `:year`: The year to query (e.g., `2025`).
  * `:month`: The month to query (e.g., `1` or `10`).

**Request Headers:**

  * `X-Session-Token: <your_token>`

**Success Response (200 OK):**
The keys of the `weeks` object are in `"YYYY-W##"` format.

```json
{
  "month": "2025-10",
  "weeks": {
    "2025-W44": {
      "revenue": 35,
      "cogs": 15,
      "expenses": 12,
      "profit": 8,
      "orderCount": 1
    }
  }
}
```