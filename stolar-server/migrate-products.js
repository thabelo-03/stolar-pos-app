const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from the server's root .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');

// Get the Shop ID from the command line arguments
const args = process.argv.slice(2);
const targetShopId = args[0];

if (!targetShopId) {
  console.error("\n❌ Please provide a Shop ID as an argument.");
  console.error("Usage: node scripts/migrate-products.js <YOUR_SHOP_ID>\n");
  process.exit(1);
}

async function migrate() {
  try {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not defined in .env");
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find products that have the default 'main_branch' or no shopId at all
    const query = {
        $or: [
            { shopId: { $exists: false } },
            { shopId: 'main_branch' }
        ]
    };

    const result = await Product.updateMany(
        query,
        { $set: { shopId: targetShopId } }
    );

    console.log(`\n✅ Successfully migrated ${result.modifiedCount} products to Shop ID: ${targetShopId}\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
