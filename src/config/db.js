const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Direct seed nodes fallback if SRV query times out on local Wi-Fi DNS
    const directFallbackURI = 'mongodb://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@ac-p0l3j0u-shard-00-00.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-01.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-02.9ssqshr.mongodb.net:27017/loan_management?ssl=true&replicaSet=atlas-2c1v0j-shard-0&authSource=admin&retryWrites=true&w=majority';
    
    let conn;
    try {
      conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
    } catch (srvErr) {
      if (srvErr.message && (srvErr.message.includes('querySrv') || srvErr.message.includes('ETIMEOUT'))) {
        console.warn('⚠️ SRV DNS timeout. Retrying connection using direct fallback or local replica...');
        conn = await mongoose.connect(process.env.MONGODB_DIRECT_URI || process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 8000,
        });
      } else {
        throw srvErr;
      }
    }
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
