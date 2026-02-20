'use strict';
require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/database');

const PORT = parseInt(process.env.PORT) || 5000;

const start = async () => {
  try {
    await connectDB();   // init GridFS-style local storage

    app.listen(PORT, () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   🚀  FileVault is running!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   🌐  Open in browser → http://localhost:${PORT}`);
      console.log(`   📡  API             → http://localhost:${PORT}/api/files`);
      console.log(`   ❤️   Health          → http://localhost:${PORT}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    process.on('SIGINT',  () => { console.log('\n👋 Goodbye!'); process.exit(0); });
    process.on('SIGTERM', () => process.exit(0));

  } catch (err) {
    console.error('❌  Failed to start:', err.message);
    process.exit(1);
  }
};

start();
