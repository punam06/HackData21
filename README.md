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
├── sql/
│   └── core_schema.mongodb.js # MongoDB collections and aggregation pipelines
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
id: String                    // MongoDB ObjectId
email: String                 // Unique email
passwordHash: String          // Hashed password
fullName: String              // User's full name
householdSize: Int           // Number of people in household (default: 1)
dietaryPreferences: Json[]   // Array of preferences: ["Vegetarian", "Gluten-Free"]
location: String?             // Optional location
createdAt: DateTime           // Account creation timestamp
updatedAt: DateTime           // Last update timestamp
```

**Relations**: One-to-Many with Inventory and ConsumptionLog

---

#### 2. **FoodItem** (Seed Data)
Global reference data for common food items.

```prisma
id: String                    // MongoDB ObjectId
name: String                  // Unique food item name (e.g., "Milk")
category: String              // Category: Dairy, Vegetables, Fruits, Grains, Proteins
defaultExpirationDays: Int   // Standard expiration (e.g., Milk: 7 days)
averageCost: Float            // Cost per unit
unit: String                  // Unit of measurement (kg, liter, pieces, dozen)
createdAt: DateTime
updatedAt: DateTime
```

**Seeded Items**: Milk, Rice, Eggs, Spinach, Apples, Bread, Chicken Breast, Tomato

---

#### 3. **Inventory** (User-Specific)
Tracks user's food inventory items and quantities.

```prisma
id: String                    // MongoDB ObjectId
userId: String                // Reference to User (ObjectId)
foodItemId: String?           // Optional link to global FoodItem (ObjectId)
customName: String            // User's custom name (e.g., "Organic Whole Milk")
quantity: Float               // Current quantity
unit: String                  // Unit of measurement
purchaseDate: DateTime?       // When purchased
expirationDate: DateTime?     // When expires
sourceImageUrl: String?       // URL to receipt/food image for CV
aiMetadata: Json              // AI-extracted data (brand, ripeness, quality)
createdAt: DateTime
updatedAt: DateTime
```

**Indexes**:
- `userId` - For user queries
- `expirationDate` - For finding expiring items
- `foodItemId` - For food item relations

---

#### 4. **ConsumptionLog** (Training Data)
Records all food-related actions for analytics and AI training.

```prisma
id: String                    // MongoDB ObjectId
userId: String                // Reference to User (ObjectId)
foodName: String              // Snapshot of name at time of action
actionType: Enum              // PURCHASED | CONSUMED | WASTED | DONATED
quantity: Float               // Amount involved
reasonForWaste: String?       // Why wasted/donated (e.g., "Expired")
logDate: DateTime             // When action occurred
```

**Indexes**:
- `userId` - For user queries
- `logDate` - For time-range queries
- `actionType` - For filtering by action type

---

#### 5. **Resource** (Static Content)
Educational tips, articles, and videos for sustainability.

```prisma
id: String                    // MongoDB ObjectId
title: String                 // Resource title
content: String               // Full content
categoryTag: String           // Category: Dairy, Vegetables, Storage Tips, etc.
resourceType: Enum            // TIP | ARTICLE | VIDEO
createdAt: DateTime
updatedAt: DateTime
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

Edit `.env` and set your MongoDB connection string:

```
DATABASE_URL="mongodb://localhost:27017/innovatex_food_db"
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
    '507f1f77bcf86cd799439011',  // inventoryId (MongoDB ObjectId)
    '507f1f77bcf86cd799439010',  // userId (MongoDB ObjectId)
    0.5,                          // quantityToConsume
    { reasonForWaste: null }
  );
  
  console.log(result);
  // {
  //   success: true,
  //   inventory: { id: '...', quantity: 1.0, ... },
  //   log: { id: '...', actionType: 'CONSUMED', ... },
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
    '507f1f77bcf86cd799439011',  // inventoryId
    '507f1f77bcf86cd799439010',  // userId
    0.2,                          // quantityToWaste
    'Expired'                     // reason
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
    '507f1f77bcf86cd799439010',  // userId
    {
      customName: 'Fresh Spinach Bundle',
      quantity: 0.5,
      unit: 'kg',
      foodItemId: '507f1f77bcf86cd799439020',  // ObjectId link to FoodItem
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
const expiringItems = await getExpiringItems('507f1f77bcf86cd799439010', 3);

console.log(expiringItems);
// [
//   {
//     id: '...',
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
  '507f1f77bcf86cd799439010',
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
- **JSON Objects**: `User.dietaryPreferences`, `Inventory.aiMetadata` allow flexible storage of future CV-extracted data
- **Flexible schema** for future enhancement without breaking changes

### ✅ Data Integrity
- **References**: ObjectId-based relationships between collections
- **Transactions**: Atomic operations with MongoDB session support
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
  const userId = '507f1f77bcf86cd799439010';
  
  // 1. User purchases milk
  const purchase = await purchaseItem(userId, {
    customName: 'Organic Whole Milk',
    quantity: 2,
    unit: 'liter',
    foodItemId: '507f1f77bcf86cd799439020', // Milk from FoodItem seed
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

## 📋 MongoDB Schema Reference

The **`sql/core_schema.mongodb.js`** file contains MongoDB collection definitions, schema validation, and sample aggregation pipelines.

### Collections in MongoDB

| Collection | Purpose | Indexes |
|-----------|---------|---------|
| **`users`** | System users with authentication and profile | Email (unique), createdAt |
| **`food_items`** | Master list of food items | Name (unique), category |
| **`inventory`** | User-specific inventory items | userId, expirationDate, foodItemId, purchaseDate |
| **`consumption_logs`** | Audit log of consumption actions | userId, logDate, actionType, userId+logDate |
| **`resources`** | Educational resources (tips/articles) | categoryTag, resourceType |

### Aggregation Pipelines

`core_schema.mongodb.js` includes sample pipelines:
- `userConsumptionSummaryPipeline` — Aggregated consumption statistics per user
- `expiringInventoryPipeline` — Items expiring within next 7 days

---

## 📝 Notes

- **Password Hashing**: The seed script uses a placeholder hash. In production, use `bcrypt` to hash passwords.
- **Number Precision**: MongoDB uses regular numbers. Prisma handles application-level validation for precision.
- **JSON Fields**: Stored natively in MongoDB as objects/arrays. Fully queryable with Prisma.
- **Transactions**: Prisma handles MongoDB transactions automatically (session management).

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
1. The `Inventory.aiMetadata` object will store extracted brand, ripeness, allergens, etc.
2. The `Inventory.sourceImageUrl` field will reference uploaded images
3. ConsumptionLog data becomes training data for waste prediction models

---

## 📞 Support

For issues or questions:
1. Check `.env` connection string
2. Verify MongoDB is running: `mongosh`
3. Check Prisma logs: Enable `DEBUG=*` for verbose output
4. Review `prisma/schema.prisma` for model definitions
5. Check `sql/core_schema.mongodb.js` for schema structure

---

Generated for INNOVATEX Hackathon - Part 1
