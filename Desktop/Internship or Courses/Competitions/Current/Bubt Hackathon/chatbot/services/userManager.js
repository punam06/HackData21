/**
 * User Account & Conversation History Service
 * Manages user accounts, preferences, and conversation history persistence
 */

// Safe require with error handling
let fs, path;
try {
  fs = require("fs");
  path = require("path");
} catch (e) {
  console.log("⚠️ Could not load fs/path modules");
  fs = null;
  path = null;
}

// In-memory storage for Vercel compatibility
const inMemoryStorage = {};

// Directory to store user data
const USER_DATA_DIR = path ? path.join(__dirname, "../data/users") : null;

// Flag to track if file system is available
let fileSystemAvailable = false;

// Detect serverless environment
const isServerless = () => {
  return (
    process.env.VERCEL === "1" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "production" ||
    !fs ||
    !path
  );
};

// Initialize file system ONLY in local development
if (!isServerless()) {
  try {
    if (fs && fs.existsSync && USER_DATA_DIR) {
      if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
      }
      fileSystemAvailable = true;
    }
  } catch (e) {
    console.log(`⚠️ File system init failed: ${e.message}`);
    fileSystemAvailable = false;
  }
} else {
  console.log("🚀 Serverless mode detected - using in-memory storage only");
  fileSystemAvailable = false;
}

class UserManager {
  /**
   * Create or get user account
   */
  static createUser(userId, userData = {}) {
    // Check if user exists in memory first
    if (inMemoryStorage[userId]) {
      return inMemoryStorage[userId];
    }

    // Try to check file system if available
    if (fileSystemAvailable) {
      const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
      if (fs.existsSync(userFile)) {
        return this.getUserData(userId);
      }
    }

    // Create new user
    const defaultUser = {
      userId,
      createdAt: new Date(),
      lastActive: new Date(),
      preferences: {
        language: "English",
        budget: userData.budget || "moderate", // low, moderate, high
        dietaryPreferences: userData.dietaryPreferences || [],
        familySize: userData.familySize || 1,
        allergies: userData.allergies || [],
        location: userData.location || "Bangladesh",
      },
      inventory: [],
      conversationHistory: [],
      statistics: {
        totalWasteReduced: 0,
        mealsPlanedCount: 0,
        messagesCount: 0,
        sdgScore: 50,
      },
    };

    // Store in memory
    inMemoryStorage[userId] = defaultUser;

    // Try to persist to file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(defaultUser, null, 2));
      } catch (e) {
        console.log(`Could not persist user ${userId} to file, using in-memory storage`);
      }
    }

    return defaultUser;
  }

  /**
   * Get user data
   */
  static getUserData(userId) {
    // Check in-memory storage first
    if (inMemoryStorage[userId]) {
      return inMemoryStorage[userId];
    }

    // Try to load from file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        if (fs.existsSync(userFile)) {
          const data = fs.readFileSync(userFile, "utf-8");
          const userData = JSON.parse(data);
          inMemoryStorage[userId] = userData;
          return userData;
        }
      } catch (error) {
        console.error(`Error reading user data for ${userId}:`, error);
      }
    }

    // User doesn't exist, create one
    return this.createUser(userId);
  }

  /**
   * Update user preferences
   */
  static updateUserPreferences(userId, preferences) {
    const user = this.getUserData(userId);
    if (!user) return null;

    user.preferences = {
      ...user.preferences,
      ...preferences,
    };
    user.lastActive = new Date();

    // Update in-memory storage
    inMemoryStorage[userId] = user;

    // Try to persist to file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
      } catch (e) {
        console.log(`Could not persist preferences for ${userId}, using in-memory storage`);
      }
    }

    return user;
  }

  /**
   * Save conversation to history
   */
  static saveConversation(userId, message, response, intent = "general") {
    const user = this.getUserData(userId);
    if (!user) return null;

    const conversation = {
      id: `msg_${Date.now()}`,
      timestamp: new Date(),
      userMessage: message,
      botResponse: response,
      intent,
      userPreferences: user.preferences,
    };

    user.conversationHistory.push(conversation);
    user.statistics.messagesCount += 1;
    user.lastActive = new Date();

    // Keep only last 100 conversations per session
    if (user.conversationHistory.length > 100) {
      user.conversationHistory = user.conversationHistory.slice(-100);
    }

    // Update in-memory storage
    inMemoryStorage[userId] = user;

    // Try to persist to file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
      } catch (e) {
        console.log(`Could not persist conversation for ${userId}, using in-memory storage`);
      }
    }

    return conversation;
  }

  /**
   * Get conversation history
   */
  static getConversationHistory(userId, limit = 20) {
    const user = this.getUserData(userId);
    if (!user) return [];

    return user.conversationHistory.slice(-limit);
  }

  /**
   * Get user context for prompt
   */
  static getUserContext(userId) {
    const user = this.getUserData(userId);
    if (!user) return null;

    return {
      userId,
      preferences: user.preferences,
      inventory: user.inventory,
      statistics: user.statistics,
      recentConversations: user.conversationHistory.slice(-5),
    };
  }

  /**
   * Update user inventory
   */
  static updateInventory(userId, item) {
    const user = this.getUserData(userId);
    if (!user) return null;

    user.inventory.push({
      id: `item_${Date.now()}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || "kg",
      expiryDate: item.expiryDate,
      addedDate: new Date(),
      category: item.category,
    });

    user.lastActive = new Date();

    // Update in-memory storage
    inMemoryStorage[userId] = user;

    // Try to persist to file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
      } catch (e) {
        console.log(`Could not persist inventory for ${userId}, using in-memory storage`);
      }
    }

    return user.inventory;
  }

  /**
   * Get user inventory
   */
  static getInventory(userId) {
    const user = this.getUserData(userId);
    if (!user) return [];

    return user.inventory;
  }

  /**
   * Update SDG score
   */
  static updateSDGScore(userId, newScore) {
    const user = this.getUserData(userId);
    if (!user) return null;

    user.statistics.sdgScore = Math.min(100, Math.max(0, newScore));
    user.lastActive = new Date();

    // Update in-memory storage
    inMemoryStorage[userId] = user;

    // Try to persist to file if filesystem available
    if (fileSystemAvailable) {
      try {
        const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
      } catch (e) {
        console.log(`Could not persist SDG score for ${userId}, using in-memory storage`);
      }
    }

    return user.statistics.sdgScore;
  }

  /**
   * Get all users (for analytics)
   */
  static getAllUsers() {
    const files = fs.readdirSync(USER_DATA_DIR);
    return files.map((file) => {
      try {
        const data = fs.readFileSync(path.join(USER_DATA_DIR, file), "utf-8");
        return JSON.parse(data);
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
        return null;
      }
    });
  }

  /**
   * Delete user account
   */
  static deleteUser(userId) {
    const userFile = path.join(USER_DATA_DIR, `${userId}.json`);
    if (fs.existsSync(userFile)) {
      fs.unlinkSync(userFile);
      return true;
    }
    return false;
  }

  /**
   * Export user data
   */
  static exportUserData(userId) {
    return this.getUserData(userId);
  }
}

module.exports = UserManager;
