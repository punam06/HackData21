# INNOVATEX Food Management System - Database Layer

## 📋 Overview

This is the database initialization layer for the INNOVATEX Hackathon Food Management System. It provides:

- **Complete Prisma Schema** with 5 core models (User, FoodItem, Inventory, ConsumptionLog, Resource)
- **Seeding Script** to populate initial data (food items, resources, test user)
- **Transaction Utilities** for atomic database operations (consume, waste, purchase items)
- **MongoDB** as the persistent database

## 🗂️ Directory Structure

```
database/
├── prisma/
│   ├── schema.prisma          # Core database schema (models, relations, enums)
│   └── seed.js                # Seeding script for initial data
├── lib/
│   └── transactions.js        # Transaction utilities for atomic operations
├── examples/
│   └── usage.js               # Example usage of all transaction functions
├── package.json               # Node.js dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🏗️ Database Schema

### Models

#### 1. **User**
Represents a user of the Food Management System.

```prisma
id: Int                       // Auto-increment primary key
email: String                 // Unique email
passwordHash: String          // Hashed password
fullName: String              // User's full name
householdSize: Int           // Number of people in household (default: 1)
dietaryPreferences: Json[]   // Array of preferences: ["Vegetarian", "Gluten-Free"]
location: String?             // Optional location
createdAt: DateTime           // Account creation timestamp
```

**Relations**: One-to-Many with Inventory and ConsumptionLog

---

#### 2. **FoodItem** (Seed Data)
Global reference data for common food items.

```prisma
id: Int                       // Primary key
name: String                  // Unique food item name (e.g., "Milk")
category: String              // Category: Dairy, Vegetables, Fruits, Grains, Proteins
defaultExpirationDays: Int   // Standard expiration (e.g., Milk: 7 days)
averageCost: Decimal(10,2)   // Cost per unit
unit: String                  // Unit of measurement (kg, liter, pieces, dozen)
createdAt: DateTime
```

**Seeded Items**: Milk, Rice, Eggs, Spinach, Apples, Bread, Chicken Breast, Tomato

---

#### 3. **Inventory** (User-Specific)
Tracks user's food inventory items and quantities.

```prisma
id: Int                       // Primary key
userId: Int                   // Foreign key to User
foodItemId: Int?             // Optional link to global FoodItem
customName: String            // User's custom name (e.g., "Organic Whole Milk")
quantity: Decimal(10,2)       // Current quantity
unit: String                  // Unit of measurement
purchaseDate: DateTime        // When purchased
expirationDate: DateTime?     // When expires (nullable)
sourceImageUrl: String?       // URL to receipt/food image for CV
aiMetadata: Json              // AI-extracted data (brand, ripeness, quality)
createdAt: DateTime
```

**Indexes**:
- `userId` - For user queries
- `expirationDate` - For finding expiring items
- `foodItemId` - For food item relations

---

#### 4. **ConsumptionLog** (Training Data)
Records all food-related actions for analytics and AI training.

```prisma
id: Int                       // Primary key
userId: Int                   // Foreign key to User
foodName: String              // Snapshot of name at time of action
actionType: Enum              // PURCHASED | CONSUMED | WASTED | DONATED
quantity: Decimal(10,2)       // Amount involved
reasonForWaste: String?       // Why wasted/donated (e.g., "Expired")
logDate: DateTime             // When action occurred (default: now)
```

**Indexes**:
- `userId` - For user queries
- `logDate` - For time-range queries
- `actionType` - For filtering by action type

---

#### 5. **Resource** (Static Content)
Educational tips, articles, and videos for sustainability.

```prisma
id: Int                       // Primary key
title: String                 // Resource title
content: String               // Full content
categoryTag: String           // Category: Dairy, Vegetables, Storage Tips, etc.
resourceType: Enum            // TIP | ARTICLE | VIDEO
createdAt: DateTime
```

**Seeded Resources**: 6 resources covering storage, waste reduction, and food safety

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database Connection

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and set your MySQL connection string:

```
DATABASE_URL="mysql://root:password@localhost:3306/innovatex_food_db"
```

**MongoDB Setup**:
```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify MongoDB is running
mongosh

# Exit MongoDB shell
exit
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Push Schema to Database

```bash
npm run db:push
```

Or migrate with history:

```bash
npm run prisma:migrate
```

### 5. Seed Initial Data

```bash
npm run prisma:seed
```

This will populate:
- 8 food items
- 6 resources (tips/articles)
- 1 test user (vegetarian.user@example.com)
- 4 sample inventory items
- 5 consumption logs

### 6. View Database (Optional)

```bash
npm run prisma:studio
```

Opens a web UI to browse and manage data.

---

## 💾 Transaction Functions

All transaction functions are in `lib/transactions.js`.

### **consumeItem(inventoryId, userId, quantityToConsume, options)**

Atomically consume food from inventory and create a CONSUMED log entry.

```javascript
const { consumeItem } = require('./lib/transactions');

try {
  const result = await consumeItem(
    1,           // inventoryId
    1,           // userId
    0.5,         // quantityToConsume
    { reasonForWaste: null }
  );
  
  console.log(result);
  // {
  //   success: true,
  //   inventory: { id: 1, quantity: 1.0, ... },
  //   log: { id: 1, actionType: 'CONSUMED', ... },
  //   message: "Successfully consumed 0.5 liter of Organic Whole Milk"
  // }
} catch (error) {
  console.error(error.message);
  // "Insufficient quantity. Current: 0.3 liter, Requested: 0.5 liter"
}
```

**Atomicity Guarantee**: Both inventory update and log creation succeed or both rollback.

**Validation**:
- Inventory item exists
- Belongs to authenticated user
- Sufficient quantity available
- Quantity > 0

---

### **wasteItem(inventoryId, userId, quantityToWaste, reason)**

Atomically waste/discard food and log as WASTED.

```javascript
const { wasteItem } = require('./lib/transactions');

try {
  const result = await wasteItem(
    1,                    // inventoryId
    1,                    // userId
    0.2,                  // quantityToWaste
    'Expired'             // reason
  );
  
  console.log(result.message);
  // "Recorded waste of 0.2 liter of Organic Whole Milk"
} catch (error) {
  console.error(error.message);
}
```

---

### **purchaseItem(userId, itemData)**

Atomically create an inventory item and log as PURCHASED.

```javascript
const { purchaseItem } = require('./lib/transactions');

try {
  const result = await purchaseItem(
    1,  // userId
    {
      customName: 'Fresh Spinach Bundle',
      quantity: 0.5,
      unit: 'kg',
      foodItemId: 4,  // Links to FoodItem with id 4
      expirationDate: new Date('2025-11-25')
    }
  );
  
  console.log(result.message);
  // "Successfully added 0.5 kg of Fresh Spinach Bundle to inventory"
} catch (error) {
  console.error(error.message);
}
```

---

### **getExpiringItems(userId, daysUntilExpiry)**

Find inventory items expiring soon.

```javascript
const { getExpiringItems } = require('./lib/transactions');

// Get items expiring within next 3 days
const expiringItems = await getExpiringItems(1, 3);

console.log(expiringItems);
// [
//   {
//     id: 1,
//     customName: 'Organic Whole Milk',
//     quantity: 1.5,
//     expirationDate: 2025-11-20,
//     foodItem: { name: 'Milk', category: 'Dairy', ... }
//   }
// ]
```

---

### **getUserConsumptionStats(userId, startDate, endDate)**

Aggregate consumption statistics for a time period.

```javascript
const { getUserConsumptionStats } = require('./lib/transactions');

const stats = await getUserConsumptionStats(
  1,
  new Date('2025-11-01'),
  new Date('2025-11-30')
);

console.log(stats);
// {
//   total: 5,
//   consumed: 1,
//   wasted: 1,
//   purchased: 2,
//   donated: 0,
//   totalQuantityConsumed: 0.5,
//   totalQuantityWasted: 0.3
// }
```

---

## 🔍 Key Features

### ✅ AI-Ready Design
- **JSON Columns**: `User.dietaryPreferences`, `Inventory.aiMetadata` allow flexible storage of future CV-extracted data
- **Flexible schema** for future enhancement without breaking changes

### ✅ Data Integrity
- **Foreign Keys**: Cascade deletes for user data, SetNull for optional FoodItem references
- **Transactions**: Atomic operations with Serializable isolation level
- **Indexes**: Optimized queries for expiration checks and user data retrieval

### ✅ Seeding Strategy
- Global `FoodItem` reference data reduces duplication
- Test user with realistic dietary preferences
- Sample inventory and logs for immediate testing

### ✅ Error Handling
- Detailed validation messages
- User authorization checks
- Transaction rollback on any failure
- 5-second timeout on all transactions

---

## 📊 Example: Complete Workflow

```javascript
const { purchaseItem, consumeItem, wasteItem, getExpiringItems, getUserConsumptionStats } = require('./lib/transactions');

async function demonstrateWorkflow() {
  const userId = 1;
  
  // 1. User purchases milk
  const purchase = await purchaseItem(userId, {
    customName: 'Organic Whole Milk',
    quantity: 2,
    unit: 'liter',
    foodItemId: 1, // Milk from FoodItem seed
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  const inventoryId = purchase.inventory.id;
  console.log(purchase.message);
  
  // 2. User consumes 0.5 liters
  const consume = await consumeItem(inventoryId, userId, 0.5);
  console.log(consume.message);
  
  // 3. Check for expiring items
  const expiring = await getExpiringItems(userId, 7);
  console.log(`Items expiring in next 7 days: ${expiring.length}`);
  
  // 4. Check stats for the month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date();
  const stats = await getUserConsumptionStats(userId, startOfMonth, endOfMonth);
  console.log(`This month: ${stats.consumed} items consumed, ${stats.wasted} wasted`);
}

demonstrateWorkflow().catch(console.error);
```

---

## 🔧 Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database (no history)
npm run db:push

# Create migration
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio UI
npm run prisma:studio

# Reset database (careful!)
npm run db:reset
```

---

## �️ MySQL SQL-Only Approach (Alternative to Prisma)

If you prefer direct SQL imports instead of Prisma migrations, the **`sql/`** directory contains standalone SQL files:

### Files in `sql/`

| File | Purpose | Size | Run Before |
|------|---------|------|-----------|
| **`core_schema.sql`** | Creates database and 5 tables with relationships, indexes, views | 250+ lines | First |
| **`seed_data.sql`** | Inserts 8 food items, 6 resources, test user, sample inventory | 150+ lines | After core_schema.sql |
| **`smoke_test.sql`** | Validates schema, relationships, indexes, and data | 200+ lines | Anytime |
| **`SETUP.md`** | Step-by-step guide for MySQL import and verification | Reference | Read first |

### Quick Import (SQL Only)

```bash
# Step 1: Create database and schema
mysql -u root -p < sql/core_schema.sql

# Step 2: Seed sample data
mysql -u root -p < sql/seed_data.sql

# Step 3: Verify everything
mysql -u root -p < sql/smoke_test.sql
```

### What `core_schema.sql` Creates

- **Database**: `bubt_hackathon_db` (utf8mb4, ACID-safe)
- **Tables**:
  - `users` (id, email, passwordHash, fullName, householdSize, dietaryPreferences JSON, location, timestamps)
  - `food_items` (id, name, category, defaultExpirationDays, averageCost DECIMAL, unit)
  - `inventory` (id, userId FK, foodItemId FK, customName, quantity DECIMAL, unit, dates, sourceImageUrl, aiMetadata JSON)
  - `consumption_logs` (id, userId FK, foodName, actionType ENUM, quantity, reasonForWaste, logDate)
  - `resources` (id, title, content, categoryTag, resourceType ENUM)
- **Views**:
  - `user_consumption_summary` — Aggregated stats (purchases, consumed, wasted, donated)
  - `expiring_inventory` — Items expiring in next 7 days
- **Indexes**: On userId, expirationDate, logDate, actionType (optimized for queries)
- **Constraints**: Cascade delete on users, SetNull on food_items, Enum validation

### Prisma vs. SQL

| Aspect | Prisma (ORM) | Direct SQL |
|--------|-------------|-----------|
| **Setup Time** | `npm install && npm run db:push` | `mysql -u root -p < sql/core_schema.sql` |
| **Type Safety** | ✅ Full TypeScript support | ❌ Raw SQL strings |
| **Migrations** | ✅ Auto-generated, tracked | ❌ Manual SQL versioning |
| **Best For** | Node.js apps, rapid development | Shared databases, legacy systems |
| **Flexibility** | Good (Prisma clients) | Maximum (raw SQL) |

**Recommendation**: 
- Use **Prisma** if you're building a Node.js backend (auto migrations, type safety)
- Use **SQL files** if you have a shared database or prefer raw SQL control

---

## �📝 Notes

- **Password Hashing**: The seed script uses a placeholder hash. In production, use `bcrypt` to hash passwords.
- **Decimal Type**: Used for quantities and costs to avoid floating-point precision issues.
- **JSON Fields**: Stored as LONGTEXT in MySQL 5.7+. Fully queryable with Prisma.
- **Isolation Level**: Transactions use `Serializable` for maximum safety on critical operations.

---

## 🔐 Security Considerations

- Always hash passwords before storing (use `bcrypt` in production)
- Validate `userId` in transactions (authorization)
- Use environment variables for database credentials
- Never commit `.env` file
- Implement rate limiting on transaction endpoints
- Use HTTPS in production

---

## 📈 Next Steps (Part 2)

When Computer Vision integration begins:
1. The `Inventory.aiMetadata` JSON field will store extracted brand, ripeness, allergens, etc.
2. The `Inventory.sourceImageUrl` field will reference uploaded images
3. ConsumptionLog data becomes training data for waste prediction models

---

## 📞 Support

For issues or questions:
1. Check `.env` connection string
2. Verify MySQL is running: `mysql -u root -p`
3. Check Prisma logs: Enable `DEBUG=*` for verbose output
4. Review `prisma/schema.prisma` for model definitions

---

Generated for INNOVATEX Hackathon - Part 1
