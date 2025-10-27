🧩 M5zonk API DocumentationM5zonk API is a complete, self-contained accounting and inventory backend designed for eCommerce business owners. It is built with Node.js (Express) and uses Firebase Firestore for all data storage, including custom user authentication and session management.This system manages products, warehouses, orders, profits, packaging, and financial metrics, providing a full-service platform for business management.Tech StackBackend: Node.js, Express.jsDatabase: Firebase Firestore (using firebase-admin SDK)Authentication: Custom (Firestore-based Sessions)Validation: Joi🚀 Setup & InstallationClone the repository:git clone <your-repo-url>
cd m5zonk-api
Install dependencies:npm install
Get Firebase Service Account:Go to your Firebase Project Settings > Service Accounts.Click "Generate new private key".Rename the downloaded JSON file to serviceAccountKey.json.Place this file in the root of your project directory.Create .env file:Create a file named .env in the project root and add the following line:# Server Configuration
PORT=3000

# Path to your Firebase credentials
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
Run the server:# For development (with auto-reload)
npm run dev

# For production
npm start
The API will be running at http://localhost:3000.🔑 AuthenticationThis API does not use Firebase Auth. It uses a custom session system built in Firestore.You must log in via POST /api/auth/login to receive a session token.For all protected endpoints, you must include this token in an HTTP header:Header Name: X-Session-TokenHeader Value: your-64-char-session-token...Sessions are long-lived (5 months) and are refreshed (via lastSeenAt) on every API call.📖 API Endpoint DocumentationAll endpoints are prefixed with /api.1. Auth ModuleHandles user signup, login, and logout.POST /auth/signupProtection: PublicDescription: Creates a new primary "owner" account. This atomically creates the admin, user, default warehouse, settings, and packaging presets.Body:{
  "email": "owner@business.com",
  "password": "password123",
  "businessName": "My eCommerce Store"
}
Success Response (201):{
  "message": "Admin account created successfully.",
  "adminId": "OHBm0jvBxJGTgIsFAG7o"
}
Error Response (409 Conflict):{
  "status": "fail",
  "message": "An account with this email already exists."
}
POST /auth/loginProtection: PublicDescription: Logs in a user and returns a 5-month session token.Body:{
  "email": "owner@business.com",
  "password": "password123"
}
Success Response (200):{
  "message": "Login successful.",
  "token": "2fdd70db427310f88ff91988f46bf47abf1607e3003450fb6243c33b69c945b4",
  "adminId": "OHBm0jvBxJGTgIsFAG7o",
  "userId": "hrxlGWuyXqdbaqRtuRsh",
  "role": "owner",
  "expiresAt": "2026-03-27T15:23:46.306Z"
}
Error Response (401 Unauthorized):{
  "status": "fail",
  "message": "Invalid email or password."
}
POST /auth/logoutProtection: ProtectedDescription: A placeholder for logout. The client is responsible for deleting its token.Success Response (200):{ "message": "Logged out successfully." }
2. Warehouse ModuleManages your stock locations.GET /warehousesProtection: ProtectedDescription: Lists all warehouses for your admin account.Success Response (200):[
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
POST /warehousesProtection: ProtectedDescription: Creates a new warehouse.Body:{
  "name": "Riyadh Branch"
}
Success Response (201):{
  "id": "abc...123",
  "name": "Riyadh Branch",
  "active": true
}
Error Response (403 Forbidden):{
  "status": "fail",
  "message": "Warehouse limit reached (5). Please upgrade your plan."
}
PUT /warehouses/:idProtection: ProtectedDescription: Updates a warehouse's name or active status.URL Params::id (string, required): The document ID of the warehouse.Body:{
  "name": "Riyadh Branch (Updated)",
  "active": false
}
Success Response (200):{
  "id": "abc...123",
  "name": "Riyadh Branch (Updated)",
  "active": false
}
3. Packaging Presets ModuleManages reusable packaging costs.GET /packagingProtection: ProtectedDescription: Lists all active packaging presets.Success Response (200):[
  {
    "id": "abc...",
    "name": "Small Package",
    "price": 2,
    "active": true
  },
  {
    "id": "def...",
    "name": "Bubble Wrap",
    "price": 0.5,
    "active": true
  }
]
POST /packagingProtection: ProtectedDescription: Creates a new packaging preset.Body:{
  "name": "Cardboard Box",
  "price": 1.5
}
Success Response (201):{
  "id": "xyz...789",
  "name": "Cardboard Box",
  "price": 1.5,
  "active": true
}
PUT /packaging/:idProtection: ProtectedDescription: Updates a preset's name, price, or active status.URL Params::id (string, required): The document ID of the preset.Body:{
  "price": 1.75,
  "active": false
}
Success Response (200):{
  "id": "xyz...789",
  "price": 1.75,
  "active": false
}
4. Product Management ModuleManages your inventory items.POST /productsProtection: ProtectedDescription: Creates a new product. idCode is optional and will be generated if not provided. warehouseIds is automatically generated from perWarehouse keys.Body:{
  "name": "Blue Hoodie",
  "stockPrice": 25,
  "sellPrice": 50,
  "quantityType": "finite",
  "quantity": 100,
  "idCode": "BH001",
  "perWarehouse": {
    "warehouseId123": { "quantityType": "finite", "quantity": 50 },
    "warehouseId456": { "quantityType": "finite", "quantity": 50 }
  }
}
Success Response (201):{
  "id": "prod...123",
  "name": "Blue Hoodie",
  "stockPrice": 25,
  "sellPrice": 50,
  "quantity": 100,
  "idCode": "BH001",
  "warehouseIds": ["warehouseId123", "warehouseId456"],
  "grouping": { "mode": "auto", "groupKey": "blue hoodie" },
  "active": true,
  "createdAt": { ... }
}
Error Response (409 Conflict):{
  "status": "fail",
  "message": "Product ID code 'BH001' is already in use."
}
GET /products/listProtection: ProtectedDescription: Gets a paginated list of all products, optionally filtered by warehouse.Query Params:limit (number, optional, default: 50): Number of products to return (max: 100).startAfter (string, optional): A Firestore document ID to start the next page.warehouseId (string, optional): A warehouse ID to filter by.Success Response (200):{
  "products": [
    { "id": "prod...123", "name": "Blue Hoodie", ... },
    { "id": "prod...456", "name": "Red T-Shirt", ... }
  ],
  "nextCursor": "prod...456"
}
GET /products (Search)Protection: ProtectedDescription: Searches for products by idCode (exact) or name (prefix/exact).Query Params:query (string, required): The search term (e.g., "Red T" or "BH001").mode (string, optional, default: 'prefix'): prefix or exact.Success Response (200):[
  { "id": "prod...456", "name": "Red T-Shirt", ... }
]
GET /products/:idProtection: ProtectedDescription: Gets a single product by its Firestore document ID.URL Params::id (string, required): The document ID of the product.Success Response (200):{ "id": "prod...456", "name": "Red T-Shirt", ... }
PUT /products/:idProtection: ProtectedDescription: Updates a product. If perWarehouse is updated, warehouseIds is automatically recalculated.URL Params::id (string, required): The document ID of the product.Body:{
  "sellPrice": 55,
  "quantity": 90
}
Success Response (200):{
  "id": "prod...123",
  "sellPrice": 55,
  "quantity": 90,
  "updatedAt": { ... }
}
POST /products/:id/stock-adjustProtection: ProtectedDescription: Manually adjust stock up or down.URL Params::id (string, required): The document ID of the product.Body:{
  "changeQty": -5,
  "warehouseId": "warehouseId123"
}
Success Response (200):{
  "success": true,
  "message": "Stock adjusted successfully."
}
Error Response (400 Bad Request):{
  "status": "fail",
  "message": "Not enough stock in warehouse warehouseId123."
}
5. Order Management ModuleManages sales, calculates profit, and adjusts stock via transactions.POST /ordersProtection: ProtectedDescription: Creates a new order. This is a transactional operation that:Calculates profit (revenue, cogs, expenses).Decrements stock from the specified (or default) warehouse.Atomically updates the metricsMonthly document.Allows for a custom createdAt date for back-dating orders.Body:{
  "lines": [
    {
      "productId": "prod...456",
      "qty": 2,
      "unitSellPrice": 35
    },
    {
      "productId": "prod...123",
      "qty": 1
    }
  ],
  "shippingPrice": 10,
  "extraLosses": 5,
  "packagingItems": [
    { "name": "Medium Package", "price": 5 }
  ],
  "warehouseId": "warehouseId123",
  "createdAt": "2025-01-15T10:00:00.000Z"
}
Success Response (201):{
  "id": "order...789",
  "createdAt": { "_seconds": 1736... },
  "warehouseId": "warehouseId123",
  "lines": [
    { "productId": "prod...456", "name": "Red T-Shirt", "qty": 2, ... },
    { "productId": "prod...123", "name": "Blue Hoodie", "qty": 1, ... }
  ],
  "shippingPrice": 10,
  "extraLosses": 5,
  "packagingItems": [ { "name": "Medium Package", "price": 5 } ],
  "totals": {
    "revenue": 120,
    "cogs": 55,
    "expenses": 20,
    "profit": 45,
    "profitPct": 0.375
  }
}
GET /ordersProtection: ProtectedDescription: Lists all orders, with optional filters for month or warehouse.Query Params:month (string, optional): Filter by month (e.g., 2025-10).warehouseId (string, optional): Filter by warehouse ID.Success Response (200):[
  { "id": "order...789", ... },
  { "id": "order...abc", ... }
]
GET /orders/:idProtection: ProtectedDescription: Gets a single order by its Firestore document ID.URL Params::id (string, required): The document ID of the order.Success Response (200):{ "id": "order...789", ... }
6. Financial Metrics ModuleProvides read-only access to financial summaries.GET /metrics/year/:yearProtection: ProtectedDescription: Gets a full-year summary, including totals and a list of all monthly metric documents.URL Params::year (string, required): The year to summarize (e.g., 2025).Success Response (200):{
  "year": "2025",
  "totals": {
    "revenue": 10500,
    "cogs": 4500,
    "expenses": 1200,
    "profit": 4800,
    "orderCount": 50
  },
  "months": [
    {
      "month": "2025-01",
      "revenue": 5000, ...
    },
    {
      "month": "2025-02",
      "revenue": 5500, ...
    }
  ]
}
GET /metrics/month/:year/:month/weeklyProtection: ProtectedDescription: Generates an on-the-fly weekly breakdown for a given month by reading and grouping all orders from that month.URL Params::year (string, required): The year (e.g., 2025).:month (string, required): The month (e.g., 10 or 01).Success Response (200):{
  "month": "2025-10",
  "weeks": {
    "2025-W40": {
      "revenue": 1500, "cogs": 700, "expenses": 100, "profit": 700, "orderCount": 10
    },
    "2025-W41": {
      "revenue": 2000, "cogs": 900, "expenses": 150, "profit": 950, "orderCount": 12
    }
  }
}
⚠️ Important: Firestore IndexesTo use the GET /api/products/list endpoint with the warehouseId filter, you must create a composite index.Run the query in Postman: GET /api/products/list?warehouseId=some-idThe API will fail, and your server console will log an error with a URL.Copy and paste that URL into your browser.Click "Create Index" in the Firebase console.The index will be:Collection: productsFields: warehouseIds (Array-Contains) ASC, createdAt (Desc)Query Scope: Collection Group