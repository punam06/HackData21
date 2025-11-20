// ============================================================================
// BUBT Hackathon Core Database Schema - MongoDB Version
// ============================================================================
// File: core_schema.mongodb.js
// Purpose: MongoDB collection setup and indexes for the core application
// Database: innovatex_food_db
// Collections: 5 core collections + resources + indexes for performance
// Note: Use with Prisma - this file documents MongoDB structure equivalents
// ============================================================================

// Collection: users
// Description: System users with authentication and profile information
// Create collection with schema validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "passwordHash", "householdSize"],
      properties: {
        _id: { bsonType: "objectId" },
        email: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        fullName: { bsonType: "string" },
        householdSize: { bsonType: "int", minimum: 1, default: 1 },
        dietaryPreferences: { bsonType: "array", items: { bsonType: "string" }, default: [] },
        location: { bsonType: "string" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Create indexes on users collection
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });

// ============================================================================
// Collection: food_items
// Description: Master list of food items with category and expiration metadata
// ============================================================================
db.createCollection("food_items", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name"],
      properties: {
        _id: { bsonType: "objectId" },
        name: { bsonType: "string" },
        category: { bsonType: "string" },
        defaultExpirationDays: { bsonType: "int" },
        averageCost: { bsonType: "decimal" },
        unit: { bsonType: "string" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Create indexes on food_items collection
db.food_items.createIndex({ name: 1 }, { unique: true });
db.food_items.createIndex({ category: 1 });

// ============================================================================
// Collection: inventory
// Description: User-specific inventory items with quantity, expiration, and metadata
// ============================================================================
db.createCollection("inventory", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "quantity"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        foodItemId: { bsonType: "objectId" },
        customName: { bsonType: "string" },
        quantity: { bsonType: "decimal", minimum: 0 },
        unit: { bsonType: "string" },
        purchaseDate: { bsonType: "date" },
        expirationDate: { bsonType: "date" },
        sourceImageUrl: { bsonType: "string" },
        aiMetadata: { bsonType: "object" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Create indexes on inventory collection
db.inventory.createIndex({ userId: 1 });
db.inventory.createIndex({ expirationDate: 1 });
db.inventory.createIndex({ foodItemId: 1 });
db.inventory.createIndex({ purchaseDate: 1 });
db.inventory.createIndex({ userId: 1, expirationDate: 1 });

// ============================================================================
// Collection: consumption_logs
// Description: Audit log of consumption, waste, donation, and purchase actions
// ============================================================================
db.createCollection("consumption_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "actionType"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        foodName: { bsonType: "string" },
        actionType: { 
          enum: ["PURCHASED", "CONSUMED", "WASTED", "DONATED"],
          description: "Type of action performed"
        },
        quantity: { bsonType: "decimal", minimum: 0 },
        reasonForWaste: { bsonType: "string" },
        logDate: { bsonType: "date" }
      }
    }
  }
});

// Create indexes on consumption_logs collection
db.consumption_logs.createIndex({ userId: 1 });
db.consumption_logs.createIndex({ logDate: 1 });
db.consumption_logs.createIndex({ actionType: 1 });
db.consumption_logs.createIndex({ userId: 1, logDate: 1 });

// ============================================================================
// Collection: resources
// Description: Educational resources (tips, articles, videos) for food waste reduction
// ============================================================================
db.createCollection("resources", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "resourceType"],
      properties: {
        _id: { bsonType: "objectId" },
        title: { bsonType: "string" },
        content: { bsonType: "string" },
        categoryTag: { bsonType: "string" },
        resourceType: { 
          enum: ["TIP", "ARTICLE", "VIDEO"],
          description: "Type of resource"
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
});

// Create indexes on resources collection
db.resources.createIndex({ categoryTag: 1 });
db.resources.createIndex({ resourceType: 1 });

// ============================================================================
// Aggregation Pipeline: user_consumption_summary
// Description: Aggregated consumption statistics per user
// Usage: db.users.aggregate(userConsumptionSummaryPipeline)
// ============================================================================
const userConsumptionSummaryPipeline = [
  {
    $lookup: {
      from: "consumption_logs",
      localField: "_id",
      foreignField: "userId",
      as: "logs"
    }
  },
  {
    $project: {
      _id: 1,
      email: 1,
      fullName: 1,
      totalPurchased: {
        $size: {
          $filter: {
            input: "$logs",
            as: "log",
            cond: { $eq: ["$$log.actionType", "PURCHASED"] }
          }
        }
      },
      totalConsumed: {
        $size: {
          $filter: {
            input: "$logs",
            as: "log",
            cond: { $eq: ["$$log.actionType", "CONSUMED"] }
          }
        }
      },
      totalWasted: {
        $size: {
          $filter: {
            input: "$logs",
            as: "log",
            cond: { $eq: ["$$log.actionType", "WASTED"] }
          }
        }
      },
      totalDonated: {
        $size: {
          $filter: {
            input: "$logs",
            as: "log",
            cond: { $eq: ["$$log.actionType", "DONATED"] }
          }
        }
      },
      totalWasteQty: {
        $sum: {
          $map: {
            input: "$logs",
            as: "log",
            in: {
              $cond: [
                { $eq: ["$$log.actionType", "WASTED"] },
                "$$log.quantity",
                0
              ]
            }
          }
        }
      },
      lastLogDate: { $max: "$logs.logDate" }
    }
  }
];

// ============================================================================
// Aggregation Pipeline: expiring_inventory
// Description: Items expiring within the next 7 days
// Usage: db.inventory.aggregate(expiringInventoryPipeline)
// ============================================================================
const expiringInventoryPipeline = [
  {
    $addFields: {
      daysUntilExpiry: {
        $divide: [
          { $subtract: ["$expirationDate", new Date()] },
          86400000 // milliseconds per day
        ]
      }
    }
  },
  {
    $match: {
      daysUntilExpiry: { $lte: 7, $gte: 0 }
    }
  },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  },
  {
    $lookup: {
      from: "food_items",
      localField: "foodItemId",
      foreignField: "_id",
      as: "foodItem"
    }
  },
  {
    $project: {
      _id: 1,
      userId: 1,
      email: { $arrayElemAt: ["$user.email", 0] },
      itemName: "$customName",
      foodItemName: { $arrayElemAt: ["$foodItem.name", 0] },
      quantity: 1,
      unit: 1,
      expirationDate: 1,
      daysUntilExpiry: 1
    }
  },
  {
    $sort: { expirationDate: 1 }
  }
];

// ============================================================================
// MongoDB Setup Instructions
// ============================================================================
// Run this script against your MongoDB database using:
// mongosh -u admin -p password --authenticationDatabase admin innovatex_food_db < core_schema.mongodb.js
//
// Or copy/paste each section into mongosh shell
//
// Alternative: Use Prisma with MongoDB
// Prisma automatically creates collections and enforces schema validation
// based on your prisma/schema.prisma configuration
// ============================================================================
// Notes:
// 1. MongoDB uses collections instead of tables
// 2. ObjectId (_id) is the default primary key format
// 3. Relationships are document references (store ObjectId, not foreign keys)
// 4. Indexes optimize query performance (similar to relational databases)
// 5. Schema validation provides data consistency (optional but recommended)
// 6. Aggregation pipelines replace JOIN operations
// 7. Enums are enforced via schema validation using $in operator
// 8. Cascading deletes are handled by application logic or Prisma middleware
// 9. All timestamps (createdAt, updatedAt) should be Date objects
// 10. JSON-like flexibility allows optional fields without schema changes
// ============================================================================
