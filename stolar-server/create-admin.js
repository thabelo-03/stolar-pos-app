const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

const createAdmin = async () => {
  try {
    // Connect to Database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB...');

    // Admin Credentials to Create/Reset
    const email = 'admin2@stolar.com';
    const password = 'admin123';
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Update existing user
      user.password = hashedPassword;
      user.role = 'admin';
      user.subscriptionStatus = 'active';
      user.subscriptionExpiry = new Date('2030-01-01'); // Long expiry
      await user.save();
      console.log('🔄 Existing admin account updated.');
    } else {
      // Create new user
      user = new User({
        name: 'System Admin',
        email,
        password: hashedPassword,
        role: 'admin',
        subscriptionStatus: 'active',
        subscriptionExpiry: new Date('2030-01-01')
      });
      await user.save();
      console.log('✨ New admin account created.');
    }

    console.log(`\n🔑 LOGIN DETAILS:\nEmail: ${email}\nPassword: ${password}`);
    process.exit();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

createAdmin();